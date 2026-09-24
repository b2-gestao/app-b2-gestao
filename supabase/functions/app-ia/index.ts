// Edge Function: app-ia
//
// "Análise com IA" da Programação do dia e do Fluxo de caixa. Recebe um resumo dos números
// que a tela já calculou e pede a um modelo de linguagem os pontos de atenção.
// Chamada com o token do usuário logado (verify_jwt = true); só membros do sistema.
//
// Provedor configurável por segredos (Edge Functions › Secrets), sem mudar código:
//   IA_API_KEY   chave do provedor (ou OPENAI_API_KEY)
//   IA_MODEL     id exato do modelo, como aparece na documentação do provedor
//   IA_API_URL   base da API no formato OpenAI (padrão https://api.openai.com/v1).
//                Serve para qualquer provedor compatível com /chat/completions.
//   IA_JSON_MODE "false" se o provedor não aceitar response_format json_object
//
// Sem IA_API_KEY ou IA_MODEL a função responde 503 e o app mostra a análise por regras.
//
// Entrada:  { tela: "prog" | "fluxo", contexto: {...}, regras: [{ label, text }] }
//           { tela: "modelo" } devolve só { modelo }
// Saída:    { headline, items: [{ label, text, nivel: "critico" | "atencao" | "info" | "positivo" }], modelo }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const API_KEY = Deno.env.get("IA_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
const MODEL = Deno.env.get("IA_MODEL") || "";
const API_URL = (Deno.env.get("IA_API_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
const JSON_MODE = Deno.env.get("IA_JSON_MODE") !== "false";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const TELAS: Record<string, string> = {
  prog: "Programação do dia: títulos a pagar do Sienge e lançamentos manuais do período, por empresa, confrontados com o saldo bancário inicial informado. Empresa com saldo insuficiente precisa de aporte.",
  fluxo: "Fluxo de caixa projetado para os próximos dias, por empresa: caixa inicial, receitas (parcelas a receber), pagamentos (parcelas a pagar) e lançamentos manuais. A holding envia aportes às SPEs que ficam negativas.",
};

const SISTEMA = `Você é analista financeiro sênior de uma incorporadora imobiliária brasileira (holding e SPEs).
Analise os números recebidos e aponte de 2 a 5 pontos de atenção objetivos e acionáveis, em português do Brasil.
Use apenas os dados fornecidos; não invente valores, empresas ou datas. Valores em reais no formato R$ 1.234,56.
Responda somente com JSON no formato:
{"headline": "frase curta com o ponto mais importante",
 "items": [{"label": "título curto", "text": "explicação em 1 ou 2 frases", "nivel": "critico|atencao|info|positivo"}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: membro, error: mErr } = await cliente.rpc("app_is_member");
    if (mErr || membro !== true) return json({ error: "Acesso não liberado." }, 403);

    if (!API_KEY || !MODEL) return json({ error: "IA não configurada (defina IA_API_KEY e IA_MODEL)." }, 503);

    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    // Só o nome do modelo, para o app mostrar "A IA está pensando… (modelo)" antes da resposta.
    if (b.tela === "modelo") return json({ modelo: MODEL });
    const tela = String(b.tela || "");
    if (!TELAS[tela]) return json({ error: "Tela inválida." }, 400);
    const contexto = JSON.stringify(b.contexto ?? {});
    if (contexto.length > 60000) return json({ error: "Contexto grande demais." }, 413);
    const regras = JSON.stringify(b.regras ?? []);

    const corpo: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: `Tela: ${TELAS[tela]}\nData de hoje: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\nDados (JSON):\n${contexto}\n\nPontos já detectados por regras fixas (pode confirmar, refinar ou descartar):\n${regras}` },
      ],
    };
    if (JSON_MODE) corpo.response_format = { type: "json_object" };

    const r = await fetch(`${API_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(45000),
    });
    const resp = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("app-ia: provedor respondeu", r.status, JSON.stringify(resp).slice(0, 500));
      return json({ error: `Provedor de IA respondeu ${r.status}.` }, 502);
    }
    const texto = String(resp?.choices?.[0]?.message?.content || "");
    const inicio = texto.indexOf("{"), fim = texto.lastIndexOf("}");
    const saida = JSON.parse(inicio >= 0 ? texto.slice(inicio, fim + 1) : "{}");
    const niveis = ["critico", "atencao", "info", "positivo"];
    const items = (Array.isArray(saida.items) ? saida.items : []).slice(0, 6).map((i: Record<string, unknown>) => ({
      label: String(i.label || "").slice(0, 80),
      text: String(i.text || "").slice(0, 600),
      nivel: niveis.includes(String(i.nivel)) ? String(i.nivel) : "info",
    })).filter((i: { label: string; text: string }) => i.label && i.text);
    if (!items.length) return json({ error: "A IA não retornou uma análise válida." }, 502);
    return json({ headline: String(saida.headline || items[0].text).slice(0, 300), items, modelo: MODEL });
  } catch (e) {
    console.error("app-ia:", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
