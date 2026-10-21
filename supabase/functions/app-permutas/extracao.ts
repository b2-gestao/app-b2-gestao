// Leitura da escritura (ou compromisso) de permuta em PDF pela OpenAI, com a mesma chave da app-nf.
// O PDF costuma vir escaneado, sem texto: a OpenAI lê a imagem de cada página.
// Dados pessoais (CPF, RG, endereço, filiação) não são pedidos ao modelo nem devolvidos ao app (LGPD).

import { z } from "npm:zod@4";

export class ErroExtracao extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "ErroExtracao";
    this.status = status;
  }
}

export const TIPOS_DOCUMENTO = ["ESCRITURA_PERMUTA", "COMPROMISSO_PERMUTA", "OUTRO"] as const;
export const PAGAMENTOS = ["PROPRIO", "DIVERSOS", "MISTO"] as const;

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const escrituraSchema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO),
  permutantes: z.array(z.string()),
  adquirenteNome: z.string().nullable(),
  adquirenteCnpj: z.string().nullable(),
  imoveis: z.array(z.object({
    matricula: z.string(),
    areaM2: z.number().nullable(),
    descricao: z.string().nullable(),
  })),
  areaTotalM2: z.number().nullable(),
  coeficiente: z.number().nullable(),
  percentualPermuta: z.number().nullable(),
  areaPermutaM2: z.number().nullable(),
  pagamento: z.enum(PAGAMENTOS).nullable(),
  dataEscritura: dataIso,
  dataCompromisso: dataIso,
  cartorio: z.string().nullable(),
  registroCartorio: z.string().nullable(),
  valorFiscal: z.number().nullable(),
  precoM2Tabela: z.number().nullable(),
  prazos: z.array(z.string()),
  condicoesPendentes: z.array(z.string()),
  outrosPontos: z.array(z.string()),
});

export type EscrituraExtraida = z.infer<typeof escrituraSchema>;

export const PROMPT_EXTRACAO = `Você está lendo, em PDF (normalmente escaneado), uma escritura pública ou um compromisso
particular de PERMUTA de terreno de uma incorporadora imobiliária brasileira: o dono do terreno (os "Primeiros
Permutantes" / outorgantes) entrega o terreno e recebe, em troca, um percentual da área privativa do empreendimento
que a incorporadora (a "Segunda Permutante", normalmente uma SPE) vai construir.

Extraia os campos abaixo e responda SOMENTE com JSON no schema pedido.

- tipoDocumento: "ESCRITURA_PERMUTA" (escritura pública lavrada em cartório), "COMPROMISSO_PERMUTA" (instrumento
  particular / promessa) ou "OUTRO" (não é um contrato de permuta de terreno).
- permutantes: nome completo de cada pessoa que ENTREGA o terreno (Primeiros Permutantes), incluindo o cônjuge que
  assina junto. Escreva com iniciais maiúsculas e acentos (ex.: "Lindemar Gonçalves Darós"). Não inclua a SPE, os
  representantes, os garantidores nem terceiros citados.
- adquirenteNome / adquirenteCnpj: a pessoa jurídica que RECEBE o terreno (Segunda Permutante). CNPJ só com dígitos.
- imoveis: cada terreno permutado pelos Primeiros Permutantes, com o número da matrícula como impresso
  (ex.: "27.036"), a área em m² e uma descrição curta (lote, quadra, rua, bairro, cidade/UF).
  Não inclua imóveis de terceiros que a incorporadora ainda vai adquirir.
- areaTotalM2: soma das áreas dos terrenos permutados, se o documento a declarar.
- coeficiente: índice mínimo de aproveitamento em área privativa vendável, em vezes a área do terreno
  (ex.: "05 (cinco) vezes a área do terreno" → 5). null se não houver.
- percentualPermuta: percentual da área privativa vendável que os Primeiros Permutantes recebem, em pontos
  percentuais (12% → 12).
- areaPermutaM2: área privativa mínima, em m², que os Primeiros Permutantes recebem, se declarada.
- pagamento: onde as unidades são entregues. "PROPRIO" (no empreendimento construído no próprio terreno),
  "DIVERSOS" (em outros empreendimentos) ou "MISTO". null se não estiver claro.
- dataEscritura: data em que a escritura foi lavrada/assinada (yyyy-MM-dd). Num compromisso particular, a data de
  assinatura dele.
- dataCompromisso: data do compromisso particular de permuta que antecedeu a escritura, se citado (yyyy-MM-dd).
- cartorio: nome do tabelionato e cidade/UF.
- registroCartorio: livro, folhas e protocolo numa linha (ex.: "Livro 01785-N, Folhas 103/113, Protocolo 0066772").
- valorFiscal: valor total atribuído aos imóveis para fins fiscais, em reais.
- precoM2Tabela: preço previsto de tabela por m² no lançamento, em reais, se houver.
- prazos: cada prazo contratual numa frase curta, com o número e a consequência
  (ex.: "Aprovação na prefeitura em 24 meses da escritura, prorrogável uma vez por 6 meses").
  Inclua imissão na posse, aprovação, multa por atraso, prazo de obra e tolerância, aluguel por atraso.
- condicoesPendentes: condições suspensivas ou obrigações ainda não cumpridas de que o negócio depende
  (ex.: compra de outro lote, aprovação de projeto, alvará), numa frase curta cada.
- outrosPontos: até 6 regras importantes para o controle da permuta, numa frase curta cada (vagas de garagem,
  método de escolha das unidades, multa rescisória, direito de preferência em área remanescente, garantias).

Regras:
- Nunca invente. Campo ausente ou ilegível vira null (listas vazias quando não houver itens).
- NÃO extraia CPF, RG, CNH, filiação, estado civil, profissão nem endereço de pessoas físicas.
- Números como impressos, sem arredondar, com ponto decimal (1.189,35 → 1189.35).
- Frases em português do Brasil, objetivas, sem repetir o texto jurídico inteiro.`;

const nulavel = (tipo: string) => ({ type: [tipo, "null"] });
const listaTexto = { type: "array", items: { type: "string" } };

const SCHEMA_OPENAI = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipoDocumento: { type: "string", enum: [...TIPOS_DOCUMENTO] },
    permutantes: listaTexto,
    adquirenteNome: nulavel("string"),
    adquirenteCnpj: nulavel("string"),
    imoveis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { matricula: { type: "string" }, areaM2: nulavel("number"), descricao: nulavel("string") },
        required: ["matricula", "areaM2", "descricao"],
      },
    },
    areaTotalM2: nulavel("number"),
    coeficiente: nulavel("number"),
    percentualPermuta: nulavel("number"),
    areaPermutaM2: nulavel("number"),
    pagamento: { type: ["string", "null"], enum: [...PAGAMENTOS, null] },
    dataEscritura: nulavel("string"),
    dataCompromisso: nulavel("string"),
    cartorio: nulavel("string"),
    registroCartorio: nulavel("string"),
    valorFiscal: nulavel("number"),
    precoM2Tabela: nulavel("number"),
    prazos: listaTexto,
    condicoesPendentes: listaTexto,
    outrosPontos: listaTexto,
  },
  required: [
    "tipoDocumento", "permutantes", "adquirenteNome", "adquirenteCnpj", "imoveis", "areaTotalM2", "coeficiente",
    "percentualPermuta", "areaPermutaM2", "pagamento", "dataEscritura", "dataCompromisso", "cartorio",
    "registroCartorio", "valorFiscal", "precoM2Tabela", "prazos", "condicoesPendentes", "outrosPontos",
  ],
};

/** Data fora do formato vira null em vez de derrubar a leitura inteira. */
function limparDatas(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== "object") return bruto;
  const o = { ...(bruto as Record<string, unknown>) };
  for (const k of ["dataEscritura", "dataCompromisso"]) {
    if (typeof o[k] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o[k] as string)) o[k] = null;
  }
  return o;
}

function validarSaida(texto: string): EscrituraExtraida {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroExtracao("A leitura não devolveu um JSON válido.", 502);
  }
  const r = escrituraSchema.safeParse(limparDatas(bruto));
  if (!r.success) {
    console.error("app-permutas: saída fora do schema", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    throw new ErroExtracao("Não foi possível interpretar os dados lidos da escritura.", 502);
  }
  return r.data;
}

export const modeloExtracao = () =>
  Deno.env.get("PERMUTAS_OPENAI_MODEL")?.trim() || Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4.1-mini";

interface OpenAIResposta {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface Leitura { dados: EscrituraExtraida; tokensEntrada: number | null; tokensSaida: number | null }

/** Lê o PDF (base64, sem prefixo) com a OpenAI (Responses API, input_file + json_schema estrito). */
export async function extrairEscritura(pdfBase64: string, nomeArquivo: string): Promise<Leitura> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) throw new ErroExtracao("Leitura por IA não configurada (segredo OPENAI_API_KEY).", 503);
  const modelo = modeloExtracao();
  const esforco = Deno.env.get("OPENAI_REASONING_EFFORT")?.trim() || "low";
  // Modelos de raciocínio (gpt-5*, gpt-6*, o*) recusam `temperature` e aceitam `reasoning.effort`.
  const ajuste = /^(gpt-[5-9]|o\d)/.test(modelo) ? { reasoning: { effort: esforco } } : { temperature: 0 };

  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelo,
        ...ajuste,
        input: [{
          role: "user",
          content: [
            { type: "input_file", filename: nomeArquivo, file_data: `data:application/pdf;base64,${pdfBase64}` },
            { type: "input_text", text: PROMPT_EXTRACAO },
          ],
        }],
        text: { format: { type: "json_schema", name: "escritura_permuta", strict: true, schema: SCHEMA_OPENAI } },
      }),
      signal: AbortSignal.timeout(140_000),
    });
  } catch (e) {
    const tempo = e instanceof DOMException && e.name === "TimeoutError";
    throw new ErroExtracao(tempo ? "A leitura do PDF demorou demais. Tente de novo em instantes." : "Não foi possível falar com a OpenAI.", 504);
  }

  const corpo = await resposta.text();
  if (!resposta.ok) {
    console.error("app-permutas: OpenAI respondeu", resposta.status, corpo.slice(0, 500));
    throw new ErroExtracao(`A leitura do PDF falhou (OpenAI HTTP ${resposta.status}).`, 502);
  }
  let json: OpenAIResposta;
  try {
    json = JSON.parse(corpo) as OpenAIResposta;
  } catch {
    throw new ErroExtracao("A OpenAI devolveu uma resposta ilegível.", 502);
  }
  // Em modelos de raciocínio, o output também traz blocos "reasoning"; só a mensagem interessa.
  const saida = (json.output ?? [])
    .filter((item) => item.type === undefined || item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((parte) => parte.type === undefined || parte.type === "output_text")
    .map((parte) => parte.text ?? "")
    .join("")
    .trim();
  if (!saida) throw new ErroExtracao("A OpenAI não retornou dados do documento.", 502);
  return { dados: validarSaida(saida), tokensEntrada: json.usage?.input_tokens ?? null, tokensSaida: json.usage?.output_tokens ?? null };
}
