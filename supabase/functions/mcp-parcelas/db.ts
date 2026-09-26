// Conexão com o Postgres do Supabase.
//
// Duas formas de rodar:
//   1) MCP_DB_URL definida: conecta direto como a role mcp_conector (somente leitura nos dados).
//   2) Sem MCP_DB_URL: usa SUPABASE_DB_URL (injetada automaticamente nas Edge Functions) e, em cada
//      consulta, troca para a role mcp_conector com SET LOCAL ROLE. O efeito é o mesmo: o conector
//      só enxerga o que foi concedido a mcp_conector, sem precisar cadastrar segredo.
import postgres from "npm:postgres@3.4.5";

const urlDedicada = Deno.env.get("MCP_DB_URL");
const url = urlDedicada ?? Deno.env.get("SUPABASE_DB_URL");
if (!url) throw new Error("Defina MCP_DB_URL ou SUPABASE_DB_URL");

export const sql = postgres(url, {
  max: 4,
  prepare: false, // compatível com o pooler (Supavisor, modo transação)
  idle_timeout: 20,
  connection: {
    statement_timeout: 30000, // nenhuma consulta do conector passa de 30s
    application_name: "mcp-parcelas",
  },
});

/** Segredo das chamadas internas de exportação (a função chamando a si mesma). */
export const SEGREDO_INTERNO = Deno.env.get("MCP_INTERNAL_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Executa SQL parametrizado ($1, $2...) e devolve as linhas. */
export async function consulta<T = Record<string, unknown>>(
  texto: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (urlDedicada) {
    // deno-lint-ignore no-explicit-any
    return (await sql.unsafe(texto, params as any[])) as unknown as T[];
  }
  const linhas = await sql.begin(async (tx) => {
    await tx.unsafe("set local role mcp_conector");
    await tx.unsafe("set local statement_timeout = '30s'");
    // deno-lint-ignore no-explicit-any
    return await tx.unsafe(texto, params as any[]);
  });
  return linhas as unknown as T[];
}
