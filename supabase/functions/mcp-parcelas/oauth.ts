// OAuth 2.1 com credenciais pré-emitidas (sem tela de login).
// O usuário cola no Claude: URL + Client ID + Client Secret (em "Configurações avançadas").
// /authorize aprova na hora se o Client ID estiver ativo; o Secret é conferido no /token.
// Registro dinâmico (DCR) fica DESLIGADO de propósito: só entra quem tem credencial emitida.
import { consulta } from "./db.ts";

export const BASE = (Deno.env.get("MCP_BASE_URL") ??
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/mcp-parcelas`).replace(/\/$/, "");

const ACCESS_TTL_S = 3600; // 1 hora
const REFRESH_TTL_S = 30 * 24 * 3600; // 30 dias
const CODE_TTL_S = 300; // 5 minutos

// Callbacks aceitos (Claude web/desktop/mobile). Outros podem ser somados em MCP_REDIRECTS (separados por vírgula).
const REDIRECTS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  ...(Deno.env.get("MCP_REDIRECTS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];

export interface Cliente { clientId: string; perfil: "interno" | "externo"; rotulo: string }

// ---------------------------------------------------------------- utilitários

async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function aleatorio(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function s256(verifier: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
const erroOAuth = (error: string, descricao: string, status = 400) =>
  json({ error, error_description: descricao }, status);

// ---------------------------------------------------------------- metadados (descoberta)

export function metadadosRecurso() {
  return json({
    resource: BASE,
    authorization_servers: [BASE],
    bearer_methods_supported: ["header"],
    resource_name: "Contas a Receber Habitat",
  });
}

export function metadadosServidor() {
  return json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/authorize`,
    token_endpoint: `${BASE}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    scopes_supported: ["parcelas:ler"],
    // campos exigidos por clientes que usam descoberta OpenID
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    jwks_uri: `${BASE}/jwks`,
  });
}

export const cabecalho401 = {
  "WWW-Authenticate": `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`,
};

// ---------------------------------------------------------------- /authorize

export async function autorizar(url: URL): Promise<Response> {
  const q = url.searchParams;
  const clientId = q.get("client_id") ?? "";
  const redirect = q.get("redirect_uri") ?? "";
  const state = q.get("state");
  const challenge = q.get("code_challenge");

  // Sem redirect válido não dá para devolver o erro ao Claude: mostra na tela.
  if (!REDIRECTS.includes(redirect)) {
    return new Response(`Endereço de retorno não autorizado: ${redirect}`, { status: 400 });
  }
  const voltar = (params: Record<string, string>) => {
    const u = new URL(redirect);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (state) u.searchParams.set("state", state);
    return Response.redirect(u.toString(), 302);
  };

  if (q.get("response_type") !== "code") return voltar({ error: "unsupported_response_type" });
  if (!challenge || (q.get("code_challenge_method") ?? "S256") !== "S256") {
    return voltar({ error: "invalid_request", error_description: "PKCE S256 obrigatório" });
  }
  const [cred] = await consulta<{ ativo: boolean }>(
    `select ativo and (expira_em is null or expira_em > now()) as ativo from mcp.credenciais where client_id = $1`, [clientId]);
  if (!cred?.ativo) {
    return voltar({ error: "unauthorized_client", error_description: "Client ID inválido ou desativado. Fale com o administrador." });
  }

  const code = aleatorio();
  await consulta(
    `insert into mcp.codigos (code_hash, client_id, redirect_uri, code_challenge, expira_em)
     values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [await sha256(code), clientId, redirect, challenge, CODE_TTL_S]);
  return voltar({ code });
}

// ---------------------------------------------------------------- /token

async function credencialDoPedido(req: Request, form: URLSearchParams) {
  let id = form.get("client_id") ?? "";
  let secret = form.get("client_secret") ?? "";
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [u, s] = atob(auth.slice(6)).split(":");
    id = decodeURIComponent(u);
    secret = decodeURIComponent(s ?? "");
  }
  if (!id || !secret) return null;
  const [c] = await consulta<{ client_id: string }>(
    `select client_id from mcp.credenciais
     where client_id = $1 and secret_hash = $2 and ativo and (expira_em is null or expira_em > now())`,
    [id, await sha256(secret)]);
  return c ? c.client_id : null;
}

async function emitirTokens(clientId: string) {
  const access = aleatorio();
  const refresh = aleatorio();
  await consulta(
    `insert into mcp.tokens (token_hash, tipo, client_id, expira_em) values
       ($1, 'access', $3, now() + make_interval(secs => $4)),
       ($2, 'refresh', $3, now() + make_interval(secs => $5))`,
    [await sha256(access), await sha256(refresh), clientId, ACCESS_TTL_S, REFRESH_TTL_S]);
  await consulta(`update mcp.credenciais set ultimo_uso = now() where client_id = $1`, [clientId]);
  return json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: "parcelas:ler" });
}

export async function token(req: Request): Promise<Response> {
  const form = new URLSearchParams(await req.text());
  const clientId = await credencialDoPedido(req, form);
  if (!clientId) return erroOAuth("invalid_client", "Client ID ou Client Secret inválido", 401);

  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const [c] = await consulta<{ redirect_uri: string; code_challenge: string }>(
      `update mcp.codigos set usado = true
       where code_hash = $1 and client_id = $2 and not usado and expira_em > now()
       returning redirect_uri, code_challenge`,
      [await sha256(form.get("code") ?? ""), clientId]);
    if (!c) return erroOAuth("invalid_grant", "Código inválido, expirado ou já usado");
    if (form.get("redirect_uri") && form.get("redirect_uri") !== c.redirect_uri) {
      return erroOAuth("invalid_grant", "redirect_uri diferente do usado na autorização");
    }
    if ((await s256(form.get("code_verifier") ?? "")) !== c.code_challenge) {
      return erroOAuth("invalid_grant", "code_verifier não confere (PKCE)");
    }
    return emitirTokens(clientId);
  }

  if (grant === "refresh_token") {
    const [t] = await consulta(
      `update mcp.tokens set revogado = true
       where token_hash = $1 and tipo = 'refresh' and client_id = $2 and not revogado and expira_em > now()
       returning 1`,
      [await sha256(form.get("refresh_token") ?? ""), clientId]);
    if (!t) return erroOAuth("invalid_grant", "Refresh token inválido ou expirado");
    return emitirTokens(clientId); // rotação: o refresh antigo é invalidado
  }

  return erroOAuth("unsupported_grant_type", `grant_type não suportado: ${grant}`);
}

// ---------------------------------------------------------------- validação do Bearer em /mcp

export async function validarBearer(req: Request): Promise<Cliente | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const [c] = await consulta<{ client_id: string; perfil: "interno" | "externo"; rotulo: string }>(
    `select c.client_id, c.perfil, c.rotulo
     from mcp.tokens t join mcp.credenciais c on c.client_id = t.client_id
     where t.token_hash = $1 and t.tipo = 'access' and not t.revogado and t.expira_em > now()
       and c.ativo and (c.expira_em is null or c.expira_em > now())`,
    [await sha256(h.slice(7).trim())]);
  return c ? { clientId: c.client_id, perfil: c.perfil, rotulo: c.rotulo } : null;
}
