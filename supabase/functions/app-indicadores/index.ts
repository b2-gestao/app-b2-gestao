// Edge Function: app-indicadores
//
// Indicadores econômicos da tela inicial (SELIC, CDI, IPCA, IGP-M, INCC-M), buscados na API
// SGS do Banco Central pelo servidor. Evita depender de CORS e da rede de quem abre o app.
// Chamada com o token do usuário logado (verify_jwt = true). Resultado fica em cache por 1 h.
// Se o BCB falhar numa série que tem espelho no Ipeadata (INCC-M), busca lá: mesma fonte (FGV),
// mesmos valores.
//
// Resposta: { indicadores: { SELIC: { valor: 15, data: "23/09/2026" } | null, ... } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SERIES: Record<string, number> = { SELIC: 432, CDI: 4389, IPCA: 433, "IGP-M": 189, "INCC-M": 7456 };
// Segunda fonte, por indicador: código da série no Ipeadata (http://www.ipeadata.gov.br/api/).
const IPEADATA: Record<string, string> = { "INCC-M": "IGP12_INCCMG12" };
const TTL_MS = 60 * 60 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Valor = { valor: number; data: string } | null;
let cache: { at: number; dados: Record<string, Valor> } | null = null;

async function serie(codigo: number): Promise<Valor> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`;
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`BCB ${codigo}: HTTP ${r.status}`);
  const [ultimo] = await r.json();
  const valor = parseFloat(String(ultimo?.valor).replace(",", "."));
  return Number.isFinite(valor) ? { valor, data: String(ultimo.data) } : null;
}

// O Ipeadata ignora $orderby/$top nesta rota: vem a série inteira (~55 KB), fica o mês mais recente.
async function ipeadata(codigo: string): Promise<Valor> {
  const url = `https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${codigo}')`;
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Ipeadata ${codigo}: HTTP ${r.status}`);
  const { value } = await r.json() as { value?: { VALDATA: string; VALVALOR: number | null }[] };
  const ultimo = (value ?? []).filter((v) => Number.isFinite(v.VALVALOR)).sort((a, b) => a.VALDATA.localeCompare(b.VALDATA)).pop();
  if (!ultimo) return null;
  const [ano, mes, dia] = ultimo.VALDATA.slice(0, 10).split("-");
  return { valor: ultimo.VALVALOR!, data: `${dia}/${mes}/${ano}` };
}

async function buscar(nome: string, codigo: number): Promise<Valor> {
  try {
    const v = await serie(codigo);
    if (v || !IPEADATA[nome]) return v;
  } catch (e) {
    if (!IPEADATA[nome]) throw e;
    console.error("app-indicadores:", (e as Error).message, "→ Ipeadata");
  }
  return await ipeadata(IPEADATA[nome]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!cache || Date.now() - cache.at > TTL_MS) {
    const erros: string[] = [];
    const pares = await Promise.all(Object.entries(SERIES).map(async ([nome, codigo]) => {
      try {
        return [nome, await buscar(nome, codigo)] as const;
      } catch (e) {
        erros.push(String((e as Error).message || e));
        return [nome, null] as const;
      }
    }));
    const dados = Object.fromEntries(pares);
    if (erros.length) console.error("app-indicadores:", erros.join("; "));
    // Só guarda em cache se veio pelo menos um valor; se o BCB falhou, serve o cache antigo.
    if (pares.some(([, v]) => v)) cache = { at: Date.now(), dados };
    else if (!cache) return new Response(JSON.stringify({ error: "Banco Central indisponível", detalhes: erros }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ indicadores: cache!.dados }), { headers: { ...cors, "Content-Type": "application/json" } });
});
