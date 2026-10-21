// Edge Function: app-permutas
//
// Permutas › Terrenos › Cadastros: "Importar da escritura". Recebe o PDF da escritura (ou do compromisso) de
// permuta, lê com a OpenAI (extracao.ts) e devolve a sugestão de preenchimento da modal "Novo permutante",
// com as conferências feitas aqui (soma das matrículas, matrícula × coeficiente × % contra a área declarada,
// CNPJ). Nada é gravado: o usuário revisa na tela e salva; o PDF vai junto como anexo "Escritura".
// Chamada com o token do usuário logado (verify_jwt = true). Exige editar em Permutas (app_permutas_pode(true)).
//
// Segredos (Edge Functions › Secrets), os mesmos da app-nf:
//   OPENAI_API_KEY            chave da OpenAI
//   PERMUTAS_OPENAI_MODEL     opcional; sem ele usa OPENAI_MODEL e, por fim, gpt-4.1-mini
//   OPENAI_REASONING_EFFORT   opcional, para modelos de raciocínio (padrão low)
//
// Cache (tabela app_ia_cache, tela "permutas_escritura"): a chave é o hash do PDF + versão do prompt + modelo.
// O mesmo arquivo lido de novo em até 30 dias não chama a OpenAI. Guarda só o JSON extraído (sem CPF/RG).
//
// Ações ({ acao, ... }):
//   ler_escritura  { pdfBase64, nomeArquivo } → { tipoDocumento, sugestao, avisos, modelo, cache }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ErroExtracao, extrairEscritura, modeloExtracao, type EscrituraExtraida } from "./extracao.ts";
import { montarSugestao } from "./regras.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;

// Mudou o prompt ou o schema? Suba a versão: as leituras antigas do cache deixam de valer.
const PROMPT_VERSAO = "escritura-v1";
const CACHE_DIAS = 30;
/** PDF de até 15 MB (base64 cresce ~33%). A tela confere antes de enviar. */
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_BASE64 = Math.ceil(MAX_PDF_BYTES / 3) * 4;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Base64 sem prefixo nem espaços; recusa o que não for PDF ("%PDF" em base64 começa com JVBERi). */
function limparPdf(valor: unknown): string {
  if (typeof valor !== "string" || !valor.trim()) throw new ErroExtracao("Envie o PDF em pdfBase64.", 400);
  const b64 = valor.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
  if (b64.length > MAX_BASE64) throw new ErroExtracao("O PDF é grande demais para a leitura por IA (limite de 15 MB).", 413);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new ErroExtracao("pdfBase64 não é um base64 válido.", 400);
  if (!b64.startsWith("JVBERi")) throw new ErroExtracao("O arquivo enviado não é um PDF.", 400);
  return b64;
}

const nomeSeguro = (v: unknown) =>
  (typeof v === "string" ? v : "escritura.pdf").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]+/g, "_").slice(-100).replace(/(\.pdf)?$/i, ".pdf");

// ---------- leitura com cache ----------

async function lerComCache(pdfBase64: string, nomeArquivo: string): Promise<{ dados: EscrituraExtraida; cache: boolean }> {
  const modelo = modeloExtracao();
  const hash = await sha256(`${PROMPT_VERSAO}|${modelo}|${pdfBase64}`);
  if (admin) {
    const { data: hit } = await admin.from("app_ia_cache").select("resposta, hits")
      .eq("hash", hash).gt("criado_em", new Date(Date.now() - CACHE_DIAS * 86_400_000).toISOString()).maybeSingle();
    if (hit) {
      await admin.from("app_ia_cache").update({ hits: hit.hits + 1, ultimo_uso: new Date().toISOString() }).eq("hash", hash);
      return { dados: hit.resposta as EscrituraExtraida, cache: true };
    }
  }
  const leitura = await extrairEscritura(pdfBase64, nomeArquivo);
  console.log(JSON.stringify({ app_permutas: "ler_escritura", modelo, tokens_entrada: leitura.tokensEntrada, tokens_saida: leitura.tokensSaida }));
  if (admin) {
    const { error } = await admin.from("app_ia_cache").upsert({
      hash, tela: "permutas_escritura", modelo, resposta: leitura.dados,
      tokens_entrada: leitura.tokensEntrada, tokens_saida: leitura.tokensSaida,
      criado_em: new Date().toISOString(), ultimo_uso: new Date().toISOString(), hits: 0,
    });
    if (error) console.error("app-permutas: cache", error.message);
  }
  return { dados: leitura.dados, cache: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: quem } = await cliente.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!quem?.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const [{ data: membro }, { data: pode }] = await Promise.all([
      cliente.rpc("app_is_member"),
      cliente.rpc("app_permutas_pode", { p_editar: true }),
    ]);
    if (membro !== true) return json({ error: "Acesso não liberado." }, 403);
    if (pode !== true) return json({ error: "Seu perfil não tem permissão para cadastrar permutas." }, 403);

    const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return json({ error: "O corpo da requisição deve ser um objeto JSON." }, 400);

    if (corpo.acao !== "ler_escritura") return json({ error: "Ação inválida." }, 400);
    const pdf = limparPdf(corpo.pdfBase64);
    const { dados, cache } = await lerComCache(pdf, nomeSeguro(corpo.nomeArquivo));
    const { sugestao, avisos } = montarSugestao(dados);
    return json({ tipoDocumento: dados.tipoDocumento, sugestao, avisos, modelo: modeloExtracao(), cache });
  } catch (e) {
    if (e instanceof ErroExtracao) return json({ error: e.message }, e.status);
    console.error("app-permutas:", e instanceof Error ? e.message : e);
    return json({ error: "Erro inesperado ao ler a escritura." }, 500);
  }
});
