// Leitura do PDF (NF-e, NFS-e, boleto ou fatura) por um modelo de linguagem.
// Portado de sienge-nf-automatica/src/lib/extracao/*. Provedor em NF_EXTRACAO_PROVIDER.

import { z } from "npm:zod@4";
import { ErroAplicacao } from "./sienge.ts";

export const TIPOS_DOCUMENTO = ["NFE", "NFSE", "BOLETO", "FATURA"] as const;

export const notaFiscalExtraidaSchema = z.object({
  tipoDocumento: z.enum(TIPOS_DOCUMENTO),
  numero: z.string().min(1),
  serie: z.string().nullable(),
  dataEmissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dataEmissao deve estar em yyyy-MM-dd").nullable(),
  dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dataVencimento deve estar em yyyy-MM-dd").nullable(),
  valorTotal: z.number().positive(),
  fornecedorNome: z.string().nullable(),
  fornecedorCnpj: z.string().nullable(),
  destinatarioNome: z.string().nullable(),
  destinatarioCnpj: z.string().nullable(),
  itens: z.array(
    z.object({
      codigo: z.string().nullable(),
      descricao: z.string(),
      ncm: z.string().nullable(),
      unidade: z.string().nullable(),
      quantidade: z.number().nullable(),
      valorUnitario: z.number().nullable(),
      valorTotal: z.number().nullable(),
    }),
  ),
});

export type NotaFiscalExtraida = z.infer<typeof notaFiscalExtraidaSchema>;

const PROMPT_EXTRACAO = `Você está lendo um documento de compra brasileiro em PDF. Ele é de um destes tipos:

- NFE: DANFE de NF-e (nota fiscal de produto). Tem chave de acesso de 44 dígitos e quadro "DADOS DO PRODUTO/SERVIÇO".
- NFSE: nota fiscal de serviço eletrônica (NFS-e / DANFSe), emitida por prefeitura ou pelo padrão nacional.
- FATURA: conta de concessionária — água/saneamento, energia elétrica ou internet/telefone.
  Reconhece pela logo/nome da concessionária, "código do cliente" ou "unidade consumidora",
  histórico de consumo, e pela palavra "fatura" no título. Mesmo que traga um canhoto de boleto
  para pagamento, o documento inteiro é FATURA, não BOLETO.
- BOLETO: boleto bancário avulso (não de concessionária), com linha digitável, beneficiário,
  pagador e vencimento — normalmente cobrando uma NF-e/NFS-e emitida à parte.

Identifique o tipo e extraia os campos abaixo. Responda SOMENTE com JSON no schema pedido.

- tipoDocumento: "NFE", "NFSE", "FATURA" ou "BOLETO".
- numero:
  - NFE: número da nota, só dígitos, sem zeros à esquerda e sem a série.
  - NFSE: número da NFS-e (não o número do RPS nem o código de verificação), só dígitos, sem zeros à esquerda.
  - FATURA: número da fatura ou, se não houver, o número do documento/nota impresso nela.
  - BOLETO: "Número do documento" do boleto, como impresso (não o nosso número nem a linha digitável).
- serie: série da nota como impressa (ex: "0", "1"). null para fatura, boleto ou se não houver.
- dataEmissao: yyyy-MM-dd. NFE/NFSE/FATURA: data de emissão. BOLETO: data do documento. null se não houver.
- dataVencimento: yyyy-MM-dd. FATURA/BOLETO: vencimento. NFE: vencimento da 1ª duplicata, se houver. Senão, null.
- valorTotal:
  - NFE: "VALOR TOTAL DA NOTA".
  - NFSE: valor total dos serviços (valor bruto, antes das retenções).
  - FATURA: "Total a pagar" (ou "valor do documento").
  - BOLETO: "Valor do documento".
- fornecedorNome / fornecedorCnpj: quem vende e recebe o pagamento.
  NFE: emitente. NFSE: prestador do serviço. FATURA: a concessionária. BOLETO: beneficiário (cedente).
- destinatarioNome / destinatarioCnpj: quem compra e paga.
  NFE: destinatário. NFSE: tomador do serviço. FATURA: cliente/consumidor. BOLETO: pagador (sacado).
- itens: SOMENTE para NFE. Cada linha de produto, com codigo, descricao, ncm, unidade,
  quantidade, valorUnitario e valorTotal. Para NFSE, FATURA e BOLETO, devolva lista vazia.

Regras:
- CNPJ/CPF: só os dígitos.
- Nunca invente valores. Um campo ilegível vira null (exceto tipoDocumento, numero e valorTotal, que são obrigatórios).
- Use os números como impressos, sem arredondar, e troque a vírgula decimal por ponto.
- Não confunda quem vende com quem compra. A construtora compradora é o destinatário, tomador, cliente ou pagador.`;

/** Valida o JSON devolvido pelo modelo. Qualquer provedor passa por aqui. */
function validarSaida(texto: string): NotaFiscalExtraida {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroAplicacao("extracao_falhou", "A extração não devolveu um JSON válido.", 502);
  }
  const resultado = notaFiscalExtraidaSchema.safeParse(bruto);
  if (!resultado.success) {
    throw new ErroAplicacao(
      "extracao_falhou",
      "Não foi possível ler os dados obrigatórios do documento (tipo, número e valor total).",
      422,
      { problemas: resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
    );
  }
  return resultado.data;
}

function chave(nome: string): string {
  const valor = Deno.env.get(nome)?.trim();
  if (!valor) throw new ErroAplicacao("configuracao_invalida", `Segredo ${nome} não configurado na edge function app-nf.`, 500);
  return valor;
}

// ---------- Gemini ----------

const texto = (nullable = false) => ({ type: "STRING", ...(nullable ? { nullable: true } : {}) });
const numero = (nullable = false) => ({ type: "NUMBER", ...(nullable ? { nullable: true } : {}) });

const SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    tipoDocumento: { type: "STRING", enum: [...TIPOS_DOCUMENTO] },
    numero: texto(),
    serie: texto(true),
    dataEmissao: texto(true),
    dataVencimento: texto(true),
    valorTotal: numero(),
    fornecedorNome: texto(true),
    fornecedorCnpj: texto(true),
    destinatarioNome: texto(true),
    destinatarioCnpj: texto(true),
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          codigo: texto(true),
          descricao: texto(),
          ncm: texto(true),
          unidade: texto(true),
          quantidade: numero(true),
          valorUnitario: numero(true),
          valorTotal: numero(true),
        },
        required: ["descricao"],
      },
    },
  },
  required: ["tipoDocumento", "numero", "valorTotal", "itens"],
};

interface GeminiResposta {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}

async function extrairGemini(pdfBase64: string): Promise<NotaFiscalExtraida> {
  const apiKey = chave("GEMINI_API_KEY");
  const modelo = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.1-flash-lite";
  // Gemini 3 controla o raciocínio por nível; "low" basta para extração e mantém custo e latência baixos.
  const nivel = Deno.env.get("GEMINI_THINKING_LEVEL")?.trim() || (modelo.startsWith("gemini-3") ? "low" : "");
  // Sem temperature: o Gemini 3 recomenda o padrão 1.0 e degrada com valores menores.
  const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", responseSchema: SCHEMA_GEMINI };
  if (nivel) generationConfig.thinkingConfig = { thinkingLevel: nivel };

  const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "application/pdf", data: pdfBase64 } }, { text: PROMPT_EXTRACAO }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const corpo = await resposta.text();
  if (!resposta.ok) {
    throw new ErroAplicacao("extracao_falhou", `A leitura do PDF falhou (Gemini HTTP ${resposta.status}).`, 502, { resposta: corpo.slice(0, 500) });
  }
  let json: GeminiResposta;
  try {
    json = JSON.parse(corpo) as GeminiResposta;
  } catch {
    throw new ErroAplicacao("extracao_falhou", "O Gemini devolveu uma resposta ilegível.", 502);
  }
  const saida = json.candidates?.[0]?.content?.parts
    ?.filter((parte) => !parte.thought)
    .map((parte) => parte.text ?? "")
    .join("")
    .trim();
  if (!saida) throw new ErroAplicacao("extracao_falhou", "O Gemini não retornou dados do documento.", 502);
  return validarSaida(saida);
}

// ---------- OpenAI ----------

const nulavel = (tipo: string) => ({ type: [tipo, "null"] });

const SCHEMA_OPENAI = {
  type: "object",
  additionalProperties: false,
  properties: {
    tipoDocumento: { type: "string", enum: [...TIPOS_DOCUMENTO] },
    numero: { type: "string" },
    serie: nulavel("string"),
    dataEmissao: nulavel("string"),
    dataVencimento: nulavel("string"),
    valorTotal: { type: "number" },
    fornecedorNome: nulavel("string"),
    fornecedorCnpj: nulavel("string"),
    destinatarioNome: nulavel("string"),
    destinatarioCnpj: nulavel("string"),
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          codigo: nulavel("string"),
          descricao: { type: "string" },
          ncm: nulavel("string"),
          unidade: nulavel("string"),
          quantidade: nulavel("number"),
          valorUnitario: nulavel("number"),
          valorTotal: nulavel("number"),
        },
        required: ["codigo", "descricao", "ncm", "unidade", "quantidade", "valorUnitario", "valorTotal"],
      },
    },
  },
  required: [
    "tipoDocumento", "numero", "serie", "dataEmissao", "dataVencimento", "valorTotal",
    "fornecedorNome", "fornecedorCnpj", "destinatarioNome", "destinatarioCnpj", "itens",
  ],
};

interface OpenAIResposta {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
}

async function extrairOpenAI(pdfBase64: string): Promise<NotaFiscalExtraida> {
  const apiKey = chave("OPENAI_API_KEY");
  const modelo = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4.1-mini";
  const esforco = Deno.env.get("OPENAI_REASONING_EFFORT")?.trim() || "low";
  // Modelos de raciocínio (gpt-5*, gpt-6*, o*) recusam `temperature` e aceitam `reasoning.effort`.
  const ajuste = /^(gpt-[5-9]|o\d)/.test(modelo) ? { reasoning: { effort: esforco } } : { temperature: 0 };

  const resposta = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelo,
      ...ajuste,
      input: [{
        role: "user",
        content: [
          { type: "input_file", filename: "documento.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` },
          { type: "input_text", text: PROMPT_EXTRACAO },
        ],
      }],
      text: { format: { type: "json_schema", name: "documento_compra", strict: true, schema: SCHEMA_OPENAI } },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const corpo = await resposta.text();
  if (!resposta.ok) {
    throw new ErroAplicacao("extracao_falhou", `A leitura do PDF falhou (OpenAI HTTP ${resposta.status}).`, 502, { resposta: corpo.slice(0, 500) });
  }
  let json: OpenAIResposta;
  try {
    json = JSON.parse(corpo) as OpenAIResposta;
  } catch {
    throw new ErroAplicacao("extracao_falhou", "A OpenAI devolveu uma resposta ilegível.", 502);
  }
  // Em modelos de raciocínio, o output também traz blocos "reasoning"; só a mensagem interessa.
  const saida = (json.output ?? [])
    .filter((item) => item.type === undefined || item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((parte) => parte.type === undefined || parte.type === "output_text")
    .map((parte) => parte.text ?? "")
    .join("")
    .trim();
  if (!saida) throw new ErroAplicacao("extracao_falhou", "A OpenAI não retornou dados do documento.", 502);
  return validarSaida(saida);
}

/** Lê o PDF com o provedor de NF_EXTRACAO_PROVIDER (openai, padrão, ou gemini). */
export function extrairDocumento(pdfBase64: string): Promise<NotaFiscalExtraida> {
  const nome = (Deno.env.get("NF_EXTRACAO_PROVIDER")?.trim() || "openai").toLowerCase();
  if (nome === "gemini") return extrairGemini(pdfBase64);
  if (nome === "openai") return extrairOpenAI(pdfBase64);
  throw new ErroAplicacao("configuracao_invalida", `NF_EXTRACAO_PROVIDER "${nome}" não é suportado. Use "gemini" ou "openai".`, 500);
}
