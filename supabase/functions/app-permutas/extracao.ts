// Leitura do contrato de permuta (compromisso particular ou escritura) pela OpenAI, com a mesma chave da app-nf.
// PDF com texto (Docusign): só o texto do corpo do contrato vai para o modelo (leitura.ts). PDF escaneado: o arquivo
// inteiro vai como input_file e a OpenAI lê a imagem de cada página.
// Do permutante só se extraem nome e CPF/CNPJ do principal; os demais dados pessoais não são pedidos (LGPD).

import { z } from "npm:zod@4";

export class ErroExtracao extends Error {
  readonly status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "ErroExtracao";
    this.status = status;
  }
}

export const TIPOS_DOCUMENTO = ["COMPROMISSO_PERMUTA", "ESCRITURA_PERMUTA", "OUTRO"] as const;
export const PAGAMENTOS = ["PROPRIO", "DIVERSOS", "MISTO"] as const;

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const contratoSchema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO),
  permutante: z.object({ nome: z.string().nullable(), cpfCnpj: z.string().nullable() }),
  segundaPermutante: z.object({ nome: z.string().nullable(), cnpj: z.string().nullable() }),
  imoveis: z.array(z.object({
    matricula: z.string(),
    areaM2: z.number().nullable(),
    descricao: z.string().nullable(),
  })),
  cidade: z.string().nullable(),
  inscricaoIptu: z.string().nullable(),
  ucEquatorial: z.string().nullable(),
  ucSaneago: z.string().nullable(),
  coeficiente: z.number().nullable(),
  percentualPermuta: z.number().nullable(),
  areaPermutaM2: z.number().nullable(),
  pagamento: z.enum(PAGAMENTOS).nullable(),
  unidades: z.array(z.object({
    empreendimento: z.string(),
    cnpjProprietaria: z.string().nullable(),
    unidade: z.string(),
    areaM2: z.number().nullable(),
    extras: z.string().nullable(),
  })),
  excedente: z.object({ areaM2: z.number().nullable(), valor: z.number().nullable(), condicoes: z.string().nullable() }).nullable(),
  clausulaDiferenca: z.string().nullable(),
  dataContrato: dataIso,
  dataEscritura: dataIso,
  registroEscritura: z.string().nullable(),
});

export type ContratoExtraido = z.infer<typeof contratoSchema>;

export const PROMPT_EXTRACAO = `Você está lendo um contrato de PERMUTA de terreno de uma incorporadora imobiliária brasileira
(normalmente um "Compromisso Particular de Permuta Física com Imissão de Posse para Incorporação Imobiliária", às vezes a
escritura pública de permuta). O dono do terreno (o "Primeiro Permutante" ou "Primeiros Permutantes") entrega o terreno
à "Segunda Permutante" (uma SPE) e recebe, em troca, unidades prontas, no próprio empreendimento ou em empreendimentos
de outras SPEs do grupo (as "Intervenientes Pagadoras").

Extraia os campos abaixo e responda SOMENTE com JSON no schema pedido.

- tipoDocumento: "COMPROMISSO_PERMUTA" (instrumento particular), "ESCRITURA_PERMUTA" (escritura pública lavrada em
  cartório) ou "OUTRO" (não é contrato de permuta de terreno).
- permutante: só o PRIMEIRO permutante listado (o principal), não o cônjuge. nome: nome completo ou razão social, com
  iniciais maiúsculas e acentos (ex.: "Leandro Silva Onofre", "AL20 S/A"). cpfCnpj: CPF ou CNPJ dele, só dígitos.
- segundaPermutante: a SPE que recebe o terreno. nome e cnpj (só dígitos). Não confunda com as intervenientes pagadoras.
- imoveis: cada terreno entregue pelo permutante, com o número da matrícula como impresso (ex.: "28.940"), a área do
  terreno em m² e uma descrição curta (lote, quadra, rua, bairro e construções existentes). Não inclua lotes de
  terceiros citados como condição do negócio.
- cidade: cidade/UF do terreno (ex.: "Rio Verde/GO").
- inscricaoIptu: inscrição municipal do IPTU como impressa (sem o CCI). ucEquatorial: unidade consumidora de energia
  (Equatorial/Enel). ucSaneago: unidade consumidora de água (Saneago/BRK). null se não houver.
- coeficiente: índice mínimo de aproveitamento em vezes a área do terreno (ex.: "05 (cinco) vezes" → 5). null se o
  contrato não definir o pagamento por percentual.
- percentualPermuta: percentual de área privativa que o permutante recebe, em pontos (13% → 13). null se não houver.
- areaPermutaM2: total de m² de área privativa que o permutante recebe (ex.: "239,16 m2", "497,25 m2").
- pagamento: "PROPRIO" (unidades no empreendimento a ser construído no próprio terreno), "DIVERSOS" (unidades em
  outros empreendimentos) ou "MISTO".
- unidades: cada unidade PRINCIPAL dada em pagamento (apartamento, casa, sala, lote), com o nome do empreendimento como
  escrito (ex.: "CASA LAGUNA", "ZOE HABITAT"), o CNPJ da SPE dona do empreendimento (só dígitos), o número da unidade
  (ex.: "2803"), a área privativa em m² e, em extras, as vagas de garagem, boxes, escaninhos e armários vinculados a ela
  numa frase curta (ex.: "vagas 68/68A, escaninho 28-B, armário 9"). Vagas, boxes, escaninhos e armários NUNCA são
  unidades próprias. Lista vazia se o contrato só define percentual sem unidades.
- excedente: quando as unidades somam mais m² que o devido e o permutante paga a diferença: areaM2, valor em reais e
  condicoes (parcelas, preço do m², prazo) numa frase. null se não houver.
- clausulaDiferenca: se o contrato tiver cláusula sobre diferença entre a área das unidades e a área devida (devolução
  de área ou de valor, pagamento por fora, torna, complemento, ajuste de metragem após topografia ou aprovação), resuma
  numa ou duas frases com valores, prazos e o número da cláusula. null se não houver.
- dataContrato: data de assinatura do contrato (yyyy-MM-dd), normalmente no fim, antes das assinaturas.
- dataEscritura: só em escritura pública, a data da lavratura (yyyy-MM-dd). null no compromisso.
- registroEscritura: só em escritura pública, cartório, livro, folhas e protocolo numa linha. null no compromisso.

Regras:
- Nunca invente. Campo ausente ou ilegível vira null (listas vazias quando não houver itens).
- NÃO extraia RG, CNH, filiação, estado civil, profissão, e-mail, telefone nem endereço de pessoas.
- Números como impressos, sem arredondar, com ponto decimal (1.189,35 → 1189.35).`;

const nulavel = (tipo: string) => ({ type: [tipo, "null"] });
const objeto = (props: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties: props, required: Object.keys(props) });

const SCHEMA_OPENAI = objeto({
  tipoDocumento: { type: "string", enum: [...TIPOS_DOCUMENTO] },
  permutante: objeto({ nome: nulavel("string"), cpfCnpj: nulavel("string") }),
  segundaPermutante: objeto({ nome: nulavel("string"), cnpj: nulavel("string") }),
  imoveis: { type: "array", items: objeto({ matricula: { type: "string" }, areaM2: nulavel("number"), descricao: nulavel("string") }) },
  cidade: nulavel("string"),
  inscricaoIptu: nulavel("string"),
  ucEquatorial: nulavel("string"),
  ucSaneago: nulavel("string"),
  coeficiente: nulavel("number"),
  percentualPermuta: nulavel("number"),
  areaPermutaM2: nulavel("number"),
  pagamento: { type: ["string", "null"], enum: [...PAGAMENTOS, null] },
  unidades: {
    type: "array",
    items: objeto({
      empreendimento: { type: "string" }, cnpjProprietaria: nulavel("string"), unidade: { type: "string" },
      areaM2: nulavel("number"), extras: nulavel("string"),
    }),
  },
  excedente: { anyOf: [objeto({ areaM2: nulavel("number"), valor: nulavel("number"), condicoes: nulavel("string") }), { type: "null" }] },
  clausulaDiferenca: nulavel("string"),
  dataContrato: nulavel("string"),
  dataEscritura: nulavel("string"),
  registroEscritura: nulavel("string"),
});

/** Data fora do formato vira null em vez de derrubar a leitura inteira. */
function limparDatas(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== "object") return bruto;
  const o = { ...(bruto as Record<string, unknown>) };
  for (const k of ["dataContrato", "dataEscritura"]) {
    if (typeof o[k] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o[k] as string)) o[k] = null;
  }
  return o;
}

function validarSaida(texto: string): ContratoExtraido {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroExtracao("A leitura não devolveu um JSON válido.", 502);
  }
  const r = contratoSchema.safeParse(limparDatas(bruto));
  if (!r.success) {
    console.error("app-permutas: saída fora do schema", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    throw new ErroExtracao("Não foi possível interpretar os dados lidos do contrato.", 502);
  }
  return r.data;
}

export const modeloExtracao = () =>
  Deno.env.get("PERMUTAS_OPENAI_MODEL")?.trim() || Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4.1-mini";

interface OpenAIResposta {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface Leitura { dados: ContratoExtraido; tokensEntrada: number | null; tokensSaida: number | null }

/** Fonte da leitura: o texto do corpo do contrato ou, no PDF escaneado, o próprio arquivo (base64, sem prefixo). */
export type Fonte = { texto: string } | { pdfBase64: string; nomeArquivo: string };

/** Lê o contrato com a OpenAI (Responses API, json_schema estrito). */
export async function extrairContrato(fonte: Fonte): Promise<Leitura> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) throw new ErroExtracao("Leitura por IA não configurada (segredo OPENAI_API_KEY).", 503);
  const modelo = modeloExtracao();
  const esforco = Deno.env.get("OPENAI_REASONING_EFFORT")?.trim() || "low";
  // Modelos de raciocínio (gpt-5*, gpt-6*, o*) recusam `temperature` e aceitam `reasoning.effort`.
  const ajuste = /^(gpt-[5-9]|o\d)/.test(modelo) ? { reasoning: { effort: esforco } } : { temperature: 0 };
  const documento = "texto" in fonte
    ? { type: "input_text", text: `Texto do contrato (página a página):\n\n${fonte.texto}` }
    : { type: "input_file", filename: fonte.nomeArquivo, file_data: `data:application/pdf;base64,${fonte.pdfBase64}` };

  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelo,
        ...ajuste,
        input: [{ role: "user", content: [documento, { type: "input_text", text: PROMPT_EXTRACAO }] }],
        text: { format: { type: "json_schema", name: "contrato_permuta", strict: true, schema: SCHEMA_OPENAI } },
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
