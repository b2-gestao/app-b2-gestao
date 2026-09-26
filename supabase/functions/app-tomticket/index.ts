// Edge Function: app-tomticket
//
// Notas Fiscais › Cadastros: abre no TomTicket (Help Desk) o chamado de conferência do título
// gerado pelo cadastro da nota. O chamado sai no nome de quem está logado: o e-mail vem do token
// do usuário (nunca do corpo da requisição) e é o mesmo e-mail de cliente no TomTicket.
// Chamada com o token do usuário logado (verify_jwt = true). Exige notas.cadastros (editar),
// como a app-nf; o perfil de sistema (Administrador) sempre pode.
//
// Segredos (Edge Functions › Secrets):
//   TOMTICKET_TOKEN             token da API v2.0 com "Pode criar e modificar dados", sem restrição de IP
//                               (Administração › Configurações da Conta › API › Novo Token)
//   TOMTICKET_DEPARTAMENTO      nome ou id do departamento (padrão Contabilidade)
//   TOMTICKET_CATEGORIA_PADRAO  nome ou id da categoria sugerida (padrão Conferência de Título Programação Vigente)
//
// Ações ({ acao, ... }):
//   preparar { billId }                         → dados do modal (solicitante, departamento, categorias, assunto, mensagem)
//   criar    { billId, categoriaId, mensagem }  → abre o chamado → { ok, mensagem, protocolo }
//
// API: https://api.tomticket.com/v2.0, Bearer, POST em form-data, limite de 3 requisições por segundo
// (acima disso, 429: a requisição foi recusada e pode ser repetida).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TOKEN = Deno.env.get("TOMTICKET_TOKEN") || "";
const DEPARTAMENTO = Deno.env.get("TOMTICKET_DEPARTAMENTO") || "Contabilidade";
const CATEGORIA_PADRAO = Deno.env.get("TOMTICKET_CATEGORIA_PADRAO") || "Conferência de Título Programação Vigente";

const BASE = "https://api.tomticket.com/v2.0";
const PERMISSAO = "notas.cadastros";
const ASSUNTO = "Conferência de Títulos a Pagar";
const MAX_MENSAGEM = 5000;
const CACHE_MS = 10 * 60 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

class Erro extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

// ---------- cliente TomTicket ----------

interface Resposta { status: number; corpo: Record<string, unknown> }

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uma requisição à API. Em 429 (limite de 3/s) a requisição foi recusada: espera e repete, até 2 vezes. */
async function tomticket(metodo: "GET" | "POST", caminho: string, params: Record<string, string>): Promise<Resposta> {
  if (!TOKEN) throw new Erro("A integração com o TomTicket não está configurada (segredo TOMTICKET_TOKEN).", 503);
  let url = BASE + caminho;
  let body: FormData | undefined;
  if (metodo === "GET") {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += "?" + qs;
  } else {
    body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, v);
  }
  for (let tentativa = 0; ; tentativa++) {
    let resp: Response;
    try {
      resp = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${TOKEN}` }, body });
    } catch (e) {
      throw new Erro(`Não foi possível falar com o TomTicket: ${e instanceof Error ? e.message : e}`, 502);
    }
    if (resp.status === 429 && tentativa < 2) {
      await esperar(400 * (tentativa + 1));
      continue;
    }
    const corpo = await resp.json().catch(() => ({})) as Record<string, unknown>;
    return { status: resp.status, corpo };
  }
}

function falhou(r: Resposta): boolean {
  return r.status >= 400 || r.corpo.error === true || r.corpo.success === false;
}

function erroTomticket(r: Resposta, contexto: string): Erro {
  const detalhe = typeof r.corpo.message === "string" && r.corpo.message ? r.corpo.message : `HTTP ${r.status}`;
  if (r.status === 401) return new Erro(`TomTicket recusou o token (${detalhe}). Confira se o token existe, não expirou e pode criar dados.`, 502);
  if (r.status === 403) return new Erro(`TomTicket: recurso não disponível para esta conta (${detalhe}).`, 502);
  if (r.status === 429) return new Erro("O TomTicket está recebendo muitas requisições. Tente de novo em alguns segundos.", 503);
  return new Erro(`${contexto}: ${detalhe}`, 502);
}

async function listar(caminho: string, params: Record<string, string>, contexto: string): Promise<Record<string, unknown>[]> {
  const r = await tomticket("GET", caminho, params);
  if (falhou(r)) throw erroTomticket(r, contexto);
  return Array.isArray(r.corpo.data) ? r.corpo.data as Record<string, unknown>[] : [];
}

// A documentação não descreve os campos dos itens de `data`: lê os nomes mais prováveis.
function idDe(item: Record<string, unknown>): string {
  const v = item.id ?? item.department_id ?? item.category_id ?? item.uuid;
  return v == null ? "" : String(v);
}
function nomeDe(item: Record<string, unknown>): string {
  const v = item.name ?? item.title ?? item.description ?? item.nome;
  return v == null ? "" : String(v).trim();
}

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

interface Opcao { id: string; nome: string }

/** Acha pelo id exato ou pelo nome (sem acento e sem diferença de maiúsculas). */
function encontrar(opcoes: Opcao[], alvo: string): Opcao | undefined {
  const n = normalizar(alvo);
  return opcoes.find((o) => o.id === alvo) ?? opcoes.find((o) => normalizar(o.nome) === n);
}

let cache: { em: number; departamento: Opcao; categorias: Opcao[] } | null = null;

/** Departamento configurado e suas categorias (mudam pouco: 10 min em memória). */
async function referencias(): Promise<{ departamento: Opcao; categorias: Opcao[] }> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache;
  const deps = (await listar("/department/list", {}, "Não foi possível listar os departamentos do TomTicket"))
    .map((d) => ({ id: idDe(d), nome: nomeDe(d) })).filter((d) => d.id);
  const departamento = encontrar(deps, DEPARTAMENTO);
  if (!departamento) throw new Erro(`Departamento "${DEPARTAMENTO}" não encontrado no TomTicket.`, 502);
  const categorias = (await listar("/department/category/list", { department_id: departamento.id }, "Não foi possível listar as categorias do TomTicket"))
    .map((c) => ({ id: idDe(c), nome: nomeDe(c) })).filter((c) => c.id)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  cache = { em: Date.now(), departamento, categorias };
  return cache;
}

/** true/false quando o TomTicket responde com clareza; null quando não deu para confirmar. */
async function clienteExiste(email: string): Promise<boolean | null> {
  const r = await tomticket("GET", "/customer/exists", { customer_id: email, customer_type_id: "E" });
  if (r.status === 404) return false;
  if (r.status >= 400) return null;
  const d = r.corpo.data as Record<string, unknown> | boolean | undefined;
  if (typeof d === "boolean") return d;
  if (d && typeof d === "object") {
    for (const k of ["exists", "exist", "found", "result"]) if (typeof d[k] === "boolean") return d[k] as boolean;
  }
  if (r.corpo.error === true || r.corpo.success === false) return false;
  return r.corpo.success === true ? true : null;
}

/** Id/protocolo do chamado, se o TomTicket devolver (a documentação só cita error, message e success). */
function protocoloDe(corpo: Record<string, unknown>): string | null {
  const d = corpo.data as Record<string, unknown> | string | number | undefined;
  if (typeof d === "string" || typeof d === "number") return String(d);
  if (d && typeof d === "object") {
    for (const k of ["protocol", "protocolo", "ticket_protocol", "ticket_id", "id"]) if (d[k] != null) return String(d[k]);
  }
  for (const k of ["protocol", "ticket_id"]) if (corpo[k] != null) return String(corpo[k]);
  return null;
}

function titulo(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Erro("Número do título inválido.");
  return n;
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const [{ data: pode, error: pErr }, { data: quem }] = await Promise.all([
      cliente.rpc("app_pode", { p_path: PERMISSAO, p_editar: true }),
      cliente.auth.getUser(auth.replace(/^Bearer\s+/i, "")),
    ]);
    if (!quem?.user) throw new Erro("Sessão inválida.", 401);
    if (pErr || pode !== true) throw new Erro("Seu perfil não tem permissão para abrir chamados de notas fiscais.", 403);
    const email = (quem.user.email || "").trim().toLowerCase();
    if (!email) throw new Erro("Seu usuário não tem e-mail cadastrado.", 400);

    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;

    switch (corpo.acao) {
      case "preparar": {
        const billId = titulo(corpo.billId);
        const { departamento, categorias } = await referencias();
        const clienteEncontrado = await clienteExiste(email);
        return json({
          email,
          clienteEncontrado,
          departamento,
          categorias,
          categoriaPadraoId: encontrar(categorias, CATEGORIA_PADRAO)?.id ?? null,
          assunto: ASSUNTO,
          mensagem: `Por gentileza, conferir o título ${billId}.`,
        });
      }

      case "criar": {
        titulo(corpo.billId);
        const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.replace(/\r\n/g, "\n").trim() : "";
        if (!mensagem) throw new Erro("Escreva a mensagem do chamado.");
        if (mensagem.length > MAX_MENSAGEM) throw new Erro(`A mensagem pode ter no máximo ${MAX_MENSAGEM} caracteres.`);
        const { departamento, categorias } = await referencias();
        const categoria = categorias.find((c) => c.id === String(corpo.categoriaId ?? ""));
        if (!categoria) throw new Erro("Escolha uma categoria do departamento.");

        // Sem nova tentativa depois de enviado: criar chamado não é idempotente (só o 429, recusado, se repete).
        const r = await tomticket("POST", "/ticket/new", {
          customer_id: email,
          customer_id_type: "E",
          department_id: departamento.id,
          category_id: categoria.id,
          subject: ASSUNTO,
          message: mensagem,
        });
        if (falhou(r)) throw erroTomticket(r, "O TomTicket não abriu o chamado");
        return json({
          ok: true,
          mensagem: typeof r.corpo.message === "string" ? r.corpo.message : "Chamado aberto.",
          protocolo: protocoloDe(r.corpo),
        }, 201);
      }

      default:
        return json({ error: "Ação desconhecida." }, 400);
    }
  } catch (erro) {
    if (erro instanceof Erro) return json({ error: erro.message }, erro.status);
    console.error("app-tomticket:", erro);
    return json({ error: "Erro inesperado ao abrir o chamado." }, 500);
  }
});
