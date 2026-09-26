// Configuração, erros e cliente HTTP da API REST do Sienge (Painel de Integrações).
// Portado de sienge-nf-automatica/src/lib/{config,erros}.ts e src/lib/sienge/*.

export type TipoDocumento = "NFE" | "NFSE" | "BOLETO" | "FATURA";
export type FormatoPedido = "SEQUENCIAL" | "ANUAL";

// ---------- erros ----------

export type CodigoErro =
  | "requisicao_invalida"
  | "configuracao_invalida"
  | "pedido_invalido"
  | "pedido_nao_encontrado"
  | "pedido_cancelado"
  | "nota_duplicada"
  | "centro_custo_divergente"
  | "quantidade_invalida"
  | "extracao_falhou"
  | "erro_sienge"
  | "itens_nao_vinculados"
  | "senha_invalida"
  | "sem_permissao";

export class ErroAplicacao extends Error {
  readonly codigo: CodigoErro;
  readonly status: number;
  readonly detalhes?: Record<string, unknown>;

  constructor(codigo: CodigoErro, message: string, status = 422, detalhes?: Record<string, unknown>) {
    super(message);
    this.name = "ErroAplicacao";
    this.codigo = codigo;
    this.status = status;
    this.detalhes = detalhes;
  }
}

export class ErroHttpSienge extends Error {
  readonly status: number;
  readonly corpo: unknown;

  constructor(status: number, message: string, corpo: unknown) {
    super(message);
    this.name = "ErroHttpSienge";
    this.status = status;
    this.corpo = corpo;
  }
}

// ---------- configuração (Edge Functions › Secrets) ----------

/** Dias corridos entre a data do cadastro e o vencimento da 1ª parcela. */
export const DIAS_VENCIMENTO = 17;

function env(nome: string): string {
  return Deno.env.get(nome)?.trim() || "";
}

function obrigatoria(nome: string): string {
  const valor = env(nome);
  if (!valor) {
    throw new ErroAplicacao("configuracao_invalida", `Segredo ${nome} não configurado na edge function app-nf.`, 500);
  }
  return valor;
}

/** Senha que libera a edição manual do vencimento. Sem o segredo, a edição manual fica desligada. */
export function senhaVencimento(): string {
  return env("NF_SENHA_VENCIMENTO");
}

export interface ConfigSienge {
  baseUrl: string;
  usuario: string;
  senha: string;
  formatoPedido: FormatoPedido;
  documentIds: Record<TipoDocumento, string>;
  movementTypeId: number | null;
}

export function configSienge(): ConfigSienge {
  const subdominio = env("SIENGE_SUBDOMAIN") || "habitatpn";
  const formato = (env("SIENGE_FORMATO_PEDIDO") || "SEQUENCIAL").toUpperCase();
  if (formato !== "SEQUENCIAL" && formato !== "ANUAL") {
    throw new ErroAplicacao(
      "configuracao_invalida",
      'SIENGE_FORMATO_PEDIDO deve ser "SEQUENCIAL" ou "ANUAL" (parâmetro 415 do Sienge).',
      500,
    );
  }
  const movimento = env("SIENGE_MOVEMENT_TYPE_ID");
  const movementTypeId = movimento ? Number.parseInt(movimento, 10) : null;
  if (movimento && !Number.isFinite(movementTypeId)) {
    throw new ErroAplicacao("configuracao_invalida", "SIENGE_MOVEMENT_TYPE_ID deve ser um número inteiro.", 500);
  }

  return {
    baseUrl: `https://api.sienge.com.br/${subdominio}/public/api`,
    usuario: obrigatoria("SIENGE_API_USER"),
    senha: obrigatoria("SIENGE_API_PASSWORD"),
    formatoPedido: formato,
    documentIds: {
      NFE: env("SIENGE_DOCUMENT_ID_NFE") || "NFE",
      NFSE: env("SIENGE_DOCUMENT_ID_NFSE") || "NFSE",
      BOLETO: env("SIENGE_DOCUMENT_ID_BOLETO") || "BOL",
      FATURA: env("SIENGE_DOCUMENT_ID_FATURA") || "FAT",
    },
    movementTypeId,
  };
}

/** Diferença máxima entre valor da NF e saldo do pedido para pré-marcar todos os insumos. */
export function toleranciaValor(): number {
  const bruto = env("NF_TOLERANCIA_VALOR");
  if (!bruto) return 0.01;
  const valor = Number.parseFloat(bruto);
  if (!Number.isFinite(valor) || valor < 0 || valor > 1) {
    throw new ErroAplicacao(
      "configuracao_invalida",
      "NF_TOLERANCIA_VALOR deve ser uma fração entre 0 e 1 (ex: 0.01 para 1%).",
      500,
    );
  }
  return valor;
}

// ---------- tipos da API ----------

export type StatusPedido = "PENDING" | "PARTIALLY_DELIVERED" | "FULLY_DELIVERED" | "CANCELED";

export interface PedidoCompra {
  id: number;
  formattedPurchaseOrderId?: string;
  status: StatusPedido;
  authorized?: boolean;
  disapproved?: boolean;
  supplierId: number;
  date?: string;
  buildingId?: number;
  costCenterId?: number;
  totalAmount?: number;
}

export interface ItemPedido {
  itemNumber: number;
  resourceId?: number;
  resourceCode?: string;
  resourceDescription?: string;
  detailDescription?: string;
  unitOfMeasure?: string;
  quantity?: number;
  unitPrice?: number;
  netPrice?: number;
}

export interface EntregaPrevista {
  deliveryScheduleNumber: number;
  sheduledDate?: string;
  sheduledQuantity?: number;
  deliveredQuantity?: number;
  openQuantity?: number;
}

export interface Credor {
  id: number;
  name?: string;
  tradeName?: string;
  cnpj?: string;
  cpf?: string;
  active?: boolean;
}

export interface Empresa {
  id: number;
  name?: string;
  tradeName?: string;
  cnpj?: string;
}

export interface Empreendimento {
  id: number;
  name?: string;
  companyId?: number;
  companyName?: string;
}

export interface NotaFiscalResumo {
  sequentialNumber: number;
  documentId?: string;
  number?: string;
  series?: string;
  supplierId?: number;
  companyId?: number;
  billId?: number | null;
  consistency?: "I" | "S" | "N";
}

export interface CabecalhoNotaFiscal {
  documentId: string;
  number: string;
  series?: string;
  supplierId: number;
  companyId: number;
  movementTypeId?: number;
  movementDate?: string;
  issueDate?: string;
  notes?: string;
}

export interface EntregaVinculada {
  purchaseOrderId: number;
  itemNumber: number;
  deliveryScheduleNumber: number;
  deliveredQuantity: number;
  keepBalance: boolean;
}

export interface ParcelaTitulo {
  installmentNumber: number;
  dueDate?: string;
  amount?: number;
}

interface RespostaPaginada<T> {
  resultSetMetadata?: { count?: number; offset?: number; limit?: number };
  results?: T[];
}

// ---------- cliente HTTP ----------

const TIMEOUT_MS = 30_000;
const TENTATIVAS_429 = 3;

type Query = Record<string, string | number | undefined>;
type Metodo = "GET" | "POST" | "PATCH";
type Corpo = { json: unknown } | { formData: FormData };

/** Base64 de texto UTF-8 (btoa sozinho quebra com acentos na senha). */
function base64Utf8(texto: string): string {
  let binario = "";
  for (const byte of new TextEncoder().encode(texto)) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function autorizacao(): string {
  const { usuario, senha } = configSienge();
  return `Basic ${base64Utf8(`${usuario}:${senha}`)}`;
}

function montarUrl(caminho: string, query?: Query): string {
  const url = new URL(`${configSienge().baseUrl}${caminho}`);
  for (const [chave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== "") url.searchParams.set(chave, String(valor));
  }
  return url.toString();
}

function mensagemDoErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === "object") {
    const registro = corpo as Record<string, unknown>;
    const cliente = typeof registro.clientMessage === "string" ? registro.clientMessage : null;
    const dev = typeof registro.developerMessage === "string" ? registro.developerMessage : null;
    if (cliente && dev && dev !== cliente) return `${cliente} (${dev})`;
    if (cliente) return cliente;
    if (dev) return dev;
  }
  return `O Sienge respondeu com HTTP ${status}.`;
}

async function requisitar(metodo: Metodo, caminho: string, opcoes: { query?: Query; corpo?: Corpo } = {}): Promise<unknown> {
  const url = montarUrl(caminho, opcoes.query);
  const headers: Record<string, string> = { Authorization: autorizacao(), Accept: "application/json" };
  let body: BodyInit | undefined;

  if (opcoes.corpo && "json" in opcoes.corpo) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opcoes.corpo.json);
  } else if (opcoes.corpo) {
    // Sem Content-Type: o fetch gera o boundary do multipart.
    body = opcoes.corpo.formData;
  }

  for (let tentativa = 1; ; tentativa += 1) {
    let resposta: Response;
    try {
      resposta = await fetch(url, { method: metodo, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (causa) {
      throw new ErroHttpSienge(
        0,
        `Não foi possível falar com a API do Sienge: ${causa instanceof Error ? causa.message : String(causa)}`,
        null,
      );
    }

    const texto = await resposta.text();
    let corpo: unknown = null;
    if (texto) {
      try {
        corpo = JSON.parse(texto);
      } catch {
        corpo = texto;
      }
    }

    if (resposta.status === 429 && tentativa < TENTATIVAS_429) {
      await new Promise((resolve) => setTimeout(resolve, 1_000 * tentativa));
      continue;
    }
    if (!resposta.ok) throw new ErroHttpSienge(resposta.status, mensagemDoErro(corpo, resposta.status), corpo);
    return corpo;
  }
}

async function siengeGet<T>(caminho: string, query?: Query): Promise<T> {
  return (await requisitar("GET", caminho, { query })) as T;
}

/** Igual ao siengeGet, mas devolve null em 404 em vez de lançar. */
async function siengeGetOpcional<T>(caminho: string, query?: Query): Promise<T | null> {
  try {
    return await siengeGet<T>(caminho, query);
  } catch (erro) {
    if (erro instanceof ErroHttpSienge && erro.status === 404) return null;
    throw erro;
  }
}

// ---------- recursos ----------

const LIMITE_PAGINA = 200;
const CACHE_EMPRESAS_MS = 5 * 60_000;

async function listarTodos<T>(caminho: string, query: Record<string, string | number> = {}): Promise<T[]> {
  const todos: T[] = [];
  for (let offset = 0; ; offset += LIMITE_PAGINA) {
    const pagina = await siengeGet<RespostaPaginada<T>>(caminho, { ...query, limit: LIMITE_PAGINA, offset });
    const resultados = pagina.results ?? [];
    todos.push(...resultados);
    if (resultados.length < LIMITE_PAGINA) return todos;
  }
}

export function buscarPedido(purchaseOrderId: number): Promise<PedidoCompra | null> {
  return siengeGetOpcional<PedidoCompra>(`/v1/purchase-orders/${purchaseOrderId}`);
}

/** Pedidos do fornecedor numa situação, filtrados pela API (sem carregar itens). */
export function listarPedidos(filtros: { supplierId: number; status: StatusPedido; authorized?: boolean }): Promise<PedidoCompra[]> {
  return listarTodos<PedidoCompra>("/v1/purchase-orders", {
    supplierId: filtros.supplierId,
    status: filtros.status,
    ...(filtros.authorized === undefined ? {} : { authorized: String(filtros.authorized) }),
  });
}

export function listarItensPedido(purchaseOrderId: number): Promise<ItemPedido[]> {
  return listarTodos<ItemPedido>(`/v1/purchase-orders/${purchaseOrderId}/items`);
}

export function listarEntregasItem(purchaseOrderId: number, itemNumber: number): Promise<EntregaPrevista[]> {
  return listarTodos<EntregaPrevista>(`/v1/purchase-orders/${purchaseOrderId}/items/${itemNumber}/delivery-schedules`);
}

/** Busca por CNPJ (14 dígitos) ou CPF (11 dígitos), sem máscara. */
export async function buscarCredorPorDocumento(documento: string): Promise<Credor | null> {
  const filtro = documento.length === 11 ? { cpf: documento } : { cnpj: documento };
  const resposta = await siengeGet<RespostaPaginada<Credor>>("/v1/creditors", { ...filtro, limit: 10 });
  const credores = resposta.results ?? [];
  return credores.find((c) => c.active !== false) ?? credores[0] ?? null;
}

let cacheEmpresas: { em: number; empresas: Empresa[] } | null = null;

export async function listarEmpresas(): Promise<Empresa[]> {
  if (cacheEmpresas && Date.now() - cacheEmpresas.em < CACHE_EMPRESAS_MS) return cacheEmpresas.empresas;
  const empresas = await listarTodos<Empresa>("/v1/companies");
  cacheEmpresas = { em: Date.now(), empresas };
  return empresas;
}

export function buscarEmpreendimento(enterpriseId: number): Promise<Empreendimento | null> {
  return siengeGetOpcional<Empreendimento>(`/v1/enterprises/${enterpriseId}`);
}

export async function listarNotasFiscais(filtros: { supplierId: number; number: string; documentId?: string }): Promise<NotaFiscalResumo[]> {
  const resposta = await siengeGet<RespostaPaginada<NotaFiscalResumo>>("/v1/purchase-invoices", {
    supplierId: filtros.supplierId,
    number: filtros.number,
    documentId: filtros.documentId,
    limit: LIMITE_PAGINA,
  });
  return resposta.results ?? [];
}

export function buscarNotaFiscal(sequentialNumber: number): Promise<NotaFiscalResumo | null> {
  return siengeGetOpcional<NotaFiscalResumo>(`/v1/purchase-invoices/${sequentialNumber}`);
}

export async function criarNotaFiscal(cabecalho: CabecalhoNotaFiscal): Promise<NotaFiscalResumo> {
  return (await requisitar("POST", "/v1/purchase-invoices", { corpo: { json: cabecalho } })) as NotaFiscalResumo;
}

export function vincularEntregas(sequentialNumber: number, entregas: EntregaVinculada[]): Promise<unknown> {
  return requisitar("POST", `/v1/purchase-invoices/${sequentialNumber}/items/purchase-orders/delivery-schedules`, {
    corpo: {
      json: {
        deliveriesOrder: entregas,
        copyNotesPurchaseOrders: true,
        copyNotesResources: true,
        copyAttachmentsPurchaseOrders: true,
      },
    },
  });
}

export function listarParcelas(billId: number): Promise<ParcelaTitulo[]> {
  return listarTodos<ParcelaTitulo>(`/v1/bills/${billId}/installments`);
}

export async function alterarVencimento(billId: number, installmentNumber: number, dueDate: string): Promise<void> {
  await requisitar("PATCH", `/v1/bills/${billId}/installments/${installmentNumber}`, { corpo: { json: { dueDate } } });
}

/** O Sienge aceita nome de arquivo com no máximo 100 caracteres. */
function nomeSeguro(nome: string): string {
  const limpo = nome.replace(/[^\w.\- ]+/g, "_").trim() || "nota-fiscal.pdf";
  const comExtensao = /\.pdf$/i.test(limpo) ? limpo : `${limpo}.pdf`;
  return comExtensao.length > 100 ? `${comExtensao.slice(0, 96)}.pdf` : comExtensao;
}

export async function anexarNoTitulo(billId: number, pdf: Uint8Array, nomeArquivo: string, descricao: string): Promise<void> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), nomeSeguro(nomeArquivo));
  await requisitar("POST", `/v1/bills/${billId}/attachments`, { query: { description: descricao }, corpo: { formData } });
}
