// Servidor MCP "Financeiro Habitat" (contas a receber + contas a pagar + contratos de venda) — Supabase Edge Function.
// Transporte: Streamable HTTP sem sessão (cada POST é independente, resposta em JSON).
//
// Rotas (relativas a .../functions/v1/mcp-parcelas):
//   POST /  ou  POST /mcp                   -> protocolo MCP (exige Bearer)
//   GET  /.well-known/oauth-protected-resource
//   GET  /.well-known/oauth-authorization-server  (e openid-configuration)
//   GET  /authorize    POST /token           -> OAuth com credencial pré-emitida
//   POST /interno/exportar                   -> processamento de exportação (uso interno)
import {
  autorizar, cabecalho401, metadadosRecurso, metadadosServidor, token, validarBearer, type Cliente,
} from "./oauth.ts";
import { DEFINICOES, executar } from "./ferramentas.ts";
import { catalogoPagar, DEFINICOES_PAGAR, executarPagar, NOMES_PAGAR } from "./ferramentas_pagar.ts";
import { catalogoContratos, DEFINICOES_CONTRATOS, executarContratos, NOMES_CONTRATOS } from "./ferramentas_contratos.ts";
import { INSTRUCOES } from "./instrucoes.ts";
import { processarParte } from "./exportacao.ts";
import { consulta, SEGREDO_INTERNO } from "./db.ts";

const VERSOES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-session-id",
};

const resp = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...extra },
  });

// Mapa nome-da-ferramenta -> parâmetros aceitos (a partir do inputSchema de cada uma), para
// avisar o usuário quando ele pedir para filtrar por um campo que não existe, em vez de a
// ferramenta simplesmente ignorar o filtro em silêncio (ex.: pedir "contrato X" numa ferramenta
// sem esse parâmetro não pode virar "busquei tudo sem esse filtro" sem avisar ninguém).
const TODAS_DEFINICOES = [...DEFINICOES, ...DEFINICOES_PAGAR, ...DEFINICOES_CONTRATOS];
const CAMPOS_POR_FERRAMENTA = new Map<string, string[]>(
  TODAS_DEFINICOES.map((d) => [
    d.name,
    Object.keys((d.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {}),
  ]),
);

function camposDesconhecidos(nome: string, args: Record<string, unknown>): string | null {
  const validos = CAMPOS_POR_FERRAMENTA.get(nome);
  if (!validos) return null; // ferramenta sem definição própria (não deveria acontecer)
  const desconhecidos = Object.keys(args).filter((k) => !validos.includes(k));
  if (!desconhecidos.length) return null;
  return `Campo(s) não reconhecido(s) em "${nome}": ${desconhecidos.join(", ")}. ` +
    `Parâmetros aceitos por esta ferramenta: ${validos.join(", ") || "nenhum"}. ` +
    "Para ver as colunas de dados disponíveis (diferente dos parâmetros de filtro), use listar_colunas.";
}

// deno-lint-ignore no-explicit-any
type RPC = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: any };

async function registrar(cli: Cliente, ferramenta: string, args: unknown, inicio: number, linhas: number | null, erro: string | null) {
  try {
    await consulta(
      `insert into mcp.chamadas (client_id, ferramenta, argumentos, duracao_ms, linhas, erro) values ($1, $2, $3, $4, $5, $6)`,
      [cli.clientId, ferramenta, JSON.stringify(args ?? {}), Date.now() - inicio, linhas, erro]);
  } catch (e) {
    console.error("falha ao registrar chamada", e);
  }
}

async function tratar(msg: RPC, cli: Cliente): Promise<unknown | null> {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const falha = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  const notificacao = msg.id === undefined || msg.id === null;

  switch (msg.method) {
    case "initialize": {
      const pedida = msg.params?.protocolVersion;
      return ok({
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "financeiro-habitat", title: "Financeiro Habitat (Receber, Pagar e Contratos)", version: "1.2.0" },
        instructions: INSTRUCOES,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: [...DEFINICOES, ...DEFINICOES_PAGAR, ...DEFINICOES_CONTRATOS] });
    case "tools/call": {
      const nome = msg.params?.name as string;
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const inicio = Date.now();
      try {
        const aviso = camposDesconhecidos(nome, args);
        if (aviso) {
          await registrar(cli, nome, args, inicio, null, aviso);
          return ok({ isError: true, content: [{ type: "text", text: aviso }] });
        }
        const ctx = { clientId: cli.clientId, perfil: cli.perfil };
        const r = (NOMES_PAGAR.has(nome)
          ? await executarPagar(nome, args, ctx)
          : NOMES_CONTRATOS.has(nome)
          ? await executarContratos(nome, args, ctx)
          : nome === "listar_colunas" && args.base === "pagar"
          ? catalogoPagar(args.visao as string | undefined)
          : nome === "listar_colunas" && args.base === "contratos"
          ? catalogoContratos(ctx)
          : await executar(nome, args, ctx)) as Record<string, unknown>;
        const linhas = Array.isArray(r.dados) ? r.dados.length : null;
        await registrar(cli, nome, args, inicio, linhas, null);
        return ok({ content: [{ type: "text", text: JSON.stringify(r) }] });
      } catch (e) {
        const texto = e instanceof Error ? e.message : String(e);
        await registrar(cli, nome, args, inicio, null, texto);
        const timeout = /statement timeout|canceling statement/i.test(texto);
        return ok({
          isError: true,
          content: [{
            type: "text",
            text: timeout
              ? "A consulta demorou demais (mais de 30s). Peça ao usuário para restringir o período ou a empresa, ou use totais_receber / totais_pagar / totais_contratos."
              : `Erro: ${texto}`,
          }],
        });
      }
    }
    default:
      if (notificacao) return null; // notifications/initialized, cancelled etc.
      return falha(-32601, `Método não suportado: ${msg.method}`);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Remove o prefixo da função (com ou sem /functions/v1) para ficar só a rota.
  const rota = url.pathname.replace(/^(\/functions\/v1)?\/mcp-parcelas/, "") || "/";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    // --- descoberta OAuth (aceita as variações de caminho que os clientes tentam)
    if (req.method === "GET" && rota.includes("/.well-known/oauth-protected-resource")) return metadadosRecurso();
    if (req.method === "GET" && (rota.includes("/.well-known/oauth-authorization-server") || rota.includes("/.well-known/openid-configuration"))) {
      return metadadosServidor();
    }
    if (req.method === "GET" && rota === "/jwks") return resp({ keys: [] });
    if (req.method === "GET" && rota === "/authorize") return await autorizar(url);
    if (req.method === "POST" && rota === "/token") return await token(req);

    // --- processamento interno de exportação (chamado pela própria função)
    if (req.method === "POST" && rota === "/interno/exportar") {
      if (!SEGREDO_INTERNO || req.headers.get("x-mcp-interno") !== SEGREDO_INTERNO) return resp({ erro: "proibido" }, 403);
      const { id } = await req.json();
      // @ts-ignore EdgeRuntime existe no runtime do Supabase
      EdgeRuntime.waitUntil(processarParte(id));
      return resp({ aceito: true }, 202);
    }

    // --- MCP
    if (rota === "/" || rota === "/mcp") {
      if (req.method !== "POST") return resp({ erro: "Use POST (Streamable HTTP sem SSE)" }, 405, { allow: "POST" });
      const cli = await validarBearer(req);
      if (!cli) return resp({ error: "invalid_token", error_description: "Token ausente ou expirado" }, 401, cabecalho401);

      const corpo = await req.json();
      if (Array.isArray(corpo)) {
        const saidas = (await Promise.all(corpo.map((m: RPC) => tratar(m, cli)))).filter((r) => r !== null);
        return saidas.length ? resp(saidas) : new Response(null, { status: 202, headers: CORS });
      }
      const saida = await tratar(corpo as RPC, cli);
      return saida === null ? new Response(null, { status: 202, headers: CORS }) : resp(saida);
    }

    return resp({ erro: "Rota não encontrada" }, 404);
  } catch (e) {
    console.error(e);
    return resp({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Erro interno" } }, 500);
  }
});
