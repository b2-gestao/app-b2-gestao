// Edge Function: app-indicadores-ia
//
// Busca dados de indicadores econômicos (INCC-M) diretamente com IA.
// Usa o conhecimento treinado do modelo para retornar dados históricos.
//
// Resposta: { indicadores: { "INCC-M": [{ mes: "01/2026", valor: 0.63 }, ...] } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY = Deno.env.get("IA_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
const MODEL = Deno.env.get("IA_MODEL") || "";
const API_URL = (Deno.env.get("IA_API_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!API_KEY || !MODEL) {
    return new Response(JSON.stringify({ error: "IA não configurada" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const prompt = `Retorne os últimos 15 meses de dados do INCC-M (Índice Nacional de Construção Civil - Mão de obra) em formato JSON.

Formato esperado:
{
  "incc_m": [
    { "mes": "MM/YYYY", "valor": X.XX },
    ...
  ]
}

Use dados reais e precisos. Se não souber um mês específico, omita. Ordene do mais antigo para o mais recente.
Responda APENAS com JSON válido, sem explicações.`;

    const corpo = {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    };

    const r = await fetch(`${API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const resp = await r.json().catch(() => ({}));
      console.error("app-indicadores-ia:", r.status, resp);
      return new Response(
        JSON.stringify({ error: `Provedor de IA respondeu ${r.status}` }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }

    const resp = await r.json();
    const texto = String(resp?.choices?.[0]?.message?.content || "");

    let dados;
    try {
      dados = JSON.parse(texto);
    } catch {
      console.error("app-indicadores-ia: parse error", texto.slice(0, 200));
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Formata para o mesmo padrão que app-indicadores (último valor)
    const valores = dados?.incc_m || [];
    const ultimo = valores.length > 0 ? valores[valores.length - 1] : null;

    // Converte formato "MM/YYYY" para "DD/MM/YYYY" (primeiro dia do mês)
    const formatarData = (mesAno: string) => {
      const [mes, ano] = mesAno.split("/");
      return `01/${mes}/${ano}`;
    };

    const indicadores = {
      "INCC-M": ultimo
        ? {
            valor: ultimo.valor,
            data: formatarData(ultimo.mes),
            historico: valores.map(v => ({ mes: v.mes, valor: v.valor }))
          }
        : null,
    };

    return new Response(JSON.stringify({ indicadores }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("app-indicadores-ia:", e);
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
});
