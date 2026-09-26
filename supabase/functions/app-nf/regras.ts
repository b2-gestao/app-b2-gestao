// Regras do cadastro de nota fiscal de compra: análise, pré-visualização, vínculo dos insumos e
// gravação. Portado sem mudança de comportamento de sienge-nf-automatica/src/lib/{analise,
// preview,cadastro,vinculo,pedido,validacao,datas,contratos}.ts. Os tipos trocados com a tela
// estão duplicados em app/src/lib/nf.ts.

import {
  alterarVencimento,
  anexarNoTitulo,
  buscarCredorPorDocumento,
  buscarEmpreendimento,
  buscarNotaFiscal,
  buscarPedido,
  configSienge,
  criarNotaFiscal,
  DIAS_VENCIMENTO,
  ErroAplicacao,
  ErroHttpSienge,
  listarEmpresas,
  listarEntregasItem,
  listarItensPedido,
  listarNotasFiscais,
  listarParcelas,
  listarPedidos,
  toleranciaValor,
  vincularEntregas,
} from "./sienge.ts";
import type { Empreendimento, EntregaPrevista, EntregaVinculada, FormatoPedido, PedidoCompra, TipoDocumento } from "./sienge.ts";
import type { NotaFiscalExtraida } from "./extracao.ts";

// ---------- contratos com a tela ----------

export type DocumentoLido = NotaFiscalExtraida;

export const NOMES_TIPO: Record<TipoDocumento, string> = {
  NFE: "NF-e (nota de produto)",
  NFSE: "NFS-e (nota de serviço)",
  BOLETO: "Boleto",
  FATURA: "Fatura (água, energia, internet)",
};

export const SIGLAS_ANEXO: Record<TipoDocumento, string> = { NFE: "NF", NFSE: "NFS", BOLETO: "BLT", FATURA: "FAT" };
export const MAX_DESCRICAO_ANEXO = 500;

/** Só a NF-e traz itens com descrição; nos demais o vínculo é feito pelo valor. */
export function temItens(tipo: TipoDocumento): boolean {
  return tipo === "NFE";
}

export interface Parte {
  id: number;
  nome: string;
  cnpj: string | null;
}

export interface PedidoAberto {
  id: number;
  numero: string;
  data: string | null;
  status: "PENDING" | "PARTIALLY_DELIVERED";
  obraId: number | null;
  obraNome: string | null;
  valorTotal: number | null;
}

export interface AnaliseDocumento {
  documento: DocumentoLido;
  fornecedor: Parte | null;
  empresa: Parte | null;
  pedidos: PedidoAberto[];
  pedidosOutraEmpresa: number;
  bloqueios: string[];
}

export interface ItemNotaPreview {
  indice: number;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  unidade: string | null;
  quantidade: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
}

export interface ItemPedidoPreview {
  itemNumber: number;
  codigoInsumo: string | null;
  descricao: string;
  unidade: string | null;
  quantidadePedido: number;
  quantidadeEmAberto: number;
  precoUnitario: number;
}

export interface VinculoSugerido {
  itemNumber: number;
  indiceNota: number | null;
  similaridade: number | null;
  quantidade: number;
  selecionado: boolean;
}

export type CriterioSelecao = "valor_total" | "similaridade" | "proporcional" | "nenhum";

export interface PreviewNota {
  pedido: { id: number; numero: string; status: string; obraId: number | null; obraNome: string | null; valorEmAberto: number };
  tipoDocumento: TipoDocumento;
  documentIds: Record<TipoDocumento, string>;
  cabecalho: {
    numero: string;
    serie: string | null;
    dataEmissao: string | null;
    dataMovimento: string;
    vencimento: string;
    vencimentoDocumento: string | null;
    valorTotal: number;
    observacaoAutomatica: string;
  };
  fornecedorNota: { nome: string | null; cnpj: string | null };
  destinatarioNota: { nome: string | null; cnpj: string | null };
  fornecedor: Parte | null;
  empresa: Parte | null;
  itensNota: ItemNotaPreview[];
  itensPedido: ItemPedidoPreview[];
  vinculos: VinculoSugerido[];
  criterioSelecao: CriterioSelecao;
  /** Edição manual do vencimento disponível (segredo NF_SENHA_VENCIMENTO configurado). */
  vencimentoEditavel: boolean;
  bloqueios: string[];
  avisos: string[];
}

export interface ConfirmacaoRequest {
  purchaseOrderId: string;
  tipoDocumento: TipoDocumento;
  pdfBase64: string;
  nomeArquivo: string;
  descricaoAnexo: string;
  centroCustoId: number;
  cabecalho: {
    numero: string;
    serie: string | null;
    dataEmissao: string;
    dataMovimento: string;
    /** Hoje + DIAS_VENCIMENTO, calculado na gravação; ou a data manual liberada por senha. */
    vencimento: string;
    observacaoComplementar: string;
  };
  itens: Array<{ itemNumber: number; quantidade: number }>;
}

export interface ConfirmacaoResultado {
  sequentialNumber: number;
  billId: number | null;
  message: string;
  avisos: string[];
  /** Id da linha em app_nf_cadastros (para registrar os anexos adicionais). */
  cadastroId?: string | null;
}

export function observacaoAutomatica(numeroPedido: string): string {
  return `Pedido de compra ${numeroPedido} vinculado a esta nota. Cadastrado via Externo.`;
}

// ---------- validação e datas ----------

export function apenasDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

function mesmoDocumento(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = apenasDigitos(a);
  return x.length > 0 && x === apenasDigitos(b);
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/** Formata CNPJ (14 dígitos) ou CPF (11 dígitos). */
export function formatarDocumento(texto: string | null | undefined): string | null {
  const digitos = apenasDigitos(texto);
  if (!digitos) return null;
  if (digitos.length === 14) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digitos.length === 11) return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return digitos;
}

function diferencaRelativa(valor: number, referencia: number): number {
  if (referencia === 0) return valor === 0 ? 0 : 1;
  return Math.abs(valor - referencia) / Math.abs(referencia);
}

function arredondar(valor: number, casas = 4): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/** Data de hoje em yyyy-MM-dd no fuso de Brasília (a edge function roda em UTC). */
export function hojeBrasil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Soma dias corridos (fins de semana e feriados contam). */
export function somarDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function dataIsoValida(texto: unknown): texto is string {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

// ---------- pedido ----------

interface PedidoNormalizado {
  /** Id no formato aceito pela URL da API (parâmetro 415). */
  apiId: number;
  /** Número como o usuário vê no Sienge. */
  exibicao: string;
}

/** Converte o número do pedido para o id aceito na URL da API (depende do parâmetro 415). */
function normalizarNumeroPedido(entrada: string, formato: FormatoPedido): PedidoNormalizado {
  const texto = entrada.trim();
  if (!texto) throw new ErroAplicacao("pedido_invalido", "Informe o número do pedido de compra.", 400);

  if (formato === "SEQUENCIAL") {
    if (!/^\d+$/.test(texto)) {
      throw new ErroAplicacao(
        "pedido_invalido",
        `"${texto}" não é um número de pedido válido. Este Sienge usa numeração sequencial contínua — informe apenas o número (ex: 123).`,
        400,
      );
    }
    const apiId = Number.parseInt(texto, 10);
    return { apiId, exibicao: String(apiId) };
  }

  const comAno = texto.match(/^(\d{1,6})\s*\/\s*(\d{2}|\d{4})$/);
  if (comAno) {
    const numero = Number.parseInt(comAno[1], 10);
    const ano = comAno[2].slice(-2);
    return { apiId: Number.parseInt(`${ano}${String(numero).padStart(6, "0")}`, 10), exibicao: `${numero}/${ano}` };
  }
  // Já veio no formato da API: 8 dígitos, AA + número com zeros à esquerda.
  if (/^\d{8}$/.test(texto)) {
    const ano = texto.slice(0, 2);
    const numero = Number.parseInt(texto.slice(2), 10);
    return { apiId: Number.parseInt(texto, 10), exibicao: `${numero}/${ano}` };
  }
  throw new ErroAplicacao(
    "pedido_invalido",
    `"${texto}" não é um número de pedido válido. Este Sienge usa numeração sequencial anual — informe no formato número/ano (ex: 123/19).`,
    400,
  );
}

async function carregarPedido(pedido: PedidoNormalizado): Promise<PedidoCompra> {
  const encontrado = await buscarPedido(pedido.apiId);
  if (!encontrado) throw new ErroAplicacao("pedido_nao_encontrado", `Pedido de compra ${pedido.exibicao} não encontrado no Sienge.`, 404);
  if (encontrado.status === "CANCELED") {
    throw new ErroAplicacao("pedido_cancelado", `O pedido de compra ${pedido.exibicao} está cancelado no Sienge.`);
  }
  return encontrado;
}

/** Itens do pedido com o saldo em aberto somado das previsões de entrega. */
async function carregarItensComSaldo(purchaseOrderId: number): Promise<{ itens: ItemPedidoPreview[]; entregasPorItem: Map<number, EntregaPrevista[]> }> {
  const itensSienge = await listarItensPedido(purchaseOrderId);
  const entregasPorItem = new Map<number, EntregaPrevista[]>();
  const itens: ItemPedidoPreview[] = [];

  for (const item of itensSienge) {
    const entregas = (await listarEntregasItem(purchaseOrderId, item.itemNumber)).sort(
      (a, b) => a.deliveryScheduleNumber - b.deliveryScheduleNumber,
    );
    entregasPorItem.set(item.itemNumber, entregas);
    const emAberto = entregas.reduce((total, e) => total + Math.max(e.openQuantity ?? 0, 0), 0);
    const descricao = [item.resourceDescription, item.detailDescription].filter(Boolean).join(" — ");
    itens.push({
      itemNumber: item.itemNumber,
      codigoInsumo: item.resourceCode ?? (item.resourceId != null ? String(item.resourceId) : null),
      descricao: descricao || `Item ${item.itemNumber}`,
      unidade: item.unitOfMeasure ?? null,
      quantidadePedido: item.quantity ?? 0,
      quantidadeEmAberto: arredondar(emAberto),
      precoUnitario: item.netPrice ?? item.unitPrice ?? 0,
    });
  }
  return { itens, entregasPorItem };
}

function valorEmAberto(itens: ItemPedidoPreview[]): number {
  return arredondar(itens.reduce((total, item) => total + item.quantidadeEmAberto * item.precoUnitario, 0), 2);
}

// ---------- sugestão de vínculo ----------

const PALAVRAS_IGNORADAS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "COM", "SEM", "NA", "NO", "NAS", "NOS", "EM", "E", "PARA",
  "A", "O", "AS", "OS", "COR", "UN", "UND", "UNID", "PC", "PCS", "PECA", "TIPO", "MOD",
  "MODELO", "REF", "COD",
]);

const SIMILARIDADE_MINIMA = 0.35;

function tokens(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/[^A-Z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length >= 2 && !PALAVRAS_IGNORADAS.has(t));
}

/** Aceita abreviação por prefixo ("QUAD" ~ "QUADRADA"), mas nunca entre números. */
function tokensCasam(a: string, b: string): boolean {
  if (a === b) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  return curto.length >= 3 && !/\d/.test(curto) && longo.startsWith(curto);
}

/** Coeficiente de Dice sobre os tokens das duas descrições (0 a 1). */
function similaridadeTexto(a: string, b: string): number {
  const ta = [...new Set(tokens(a))];
  const tb = [...new Set(tokens(b))];
  if (ta.length === 0 || tb.length === 0) return 0;
  const usados = new Set<number>();
  let comuns = 0;
  for (const x of ta) {
    const j = tb.findIndex((y, i) => !usados.has(i) && tokensCasam(x, y));
    if (j >= 0) {
      usados.add(j);
      comuns += 1;
    }
  }
  return (2 * comuns) / (ta.length + tb.length);
}

function pontuar(nota: ItemNotaPreview, pedido: ItemPedidoPreview): number {
  const codigoNota = nota.codigo?.trim().toUpperCase();
  const codigoPedido = pedido.codigoInsumo?.trim().toUpperCase();
  if (codigoNota && codigoPedido && codigoNota === codigoPedido) return 1;
  const texto = similaridadeTexto(nota.descricao, pedido.descricao);
  if (texto === 0) return 0;
  const precoNota = nota.valorUnitario ?? 0;
  if (precoNota > 0 && pedido.precoUnitario > 0) {
    const proximidade = Math.min(precoNota, pedido.precoUnitario) / Math.max(precoNota, pedido.precoUnitario);
    return 0.75 * texto + 0.25 * proximidade;
  }
  return texto;
}

interface Par {
  nota: number;
  score: number;
}

function casarItens(itensNota: ItemNotaPreview[], itensPedido: ItemPedidoPreview[]): Map<number, Par> {
  const pares: Array<{ nota: number; pedido: number; score: number }> = [];
  for (const nota of itensNota) {
    for (const pedido of itensPedido) {
      if (pedido.quantidadeEmAberto <= 0) continue;
      const score = pontuar(nota, pedido);
      if (score >= SIMILARIDADE_MINIMA) pares.push({ nota: nota.indice, pedido: pedido.itemNumber, score });
    }
  }
  pares.sort((a, b) => b.score - a.score);
  const notaUsada = new Set<number>();
  const casamento = new Map<number, Par>();
  for (const par of pares) {
    if (notaUsada.has(par.nota) || casamento.has(par.pedido)) continue;
    notaUsada.add(par.nota);
    casamento.set(par.pedido, { nota: par.nota, score: par.score });
  }
  return casamento;
}

/**
 * Sugere quais insumos do pedido o documento atende.
 * - Valor igual ao saldo do pedido: marca tudo com o saldo inteiro (qualquer tipo de documento).
 * - NF-e com valor diferente: marca os insumos que casaram com itens da nota, na quantidade da nota.
 * - NFS-e/boleto com valor diferente: se o pedido tem um único insumo em aberto, marca a
 *   quantidade proporcional ao valor (ex.: medição parcial de serviço); senão, o usuário escolhe.
 */
function sugerirVinculos(
  tipo: TipoDocumento,
  itensNota: ItemNotaPreview[],
  itensPedido: ItemPedidoPreview[],
  valorNota: number,
  aberto: number,
  tolerancia: number,
): { vinculos: VinculoSugerido[]; criterio: CriterioSelecao } {
  const porValor = aberto > 0 && diferencaRelativa(valorNota, aberto) <= tolerancia;
  const casamento = temItens(tipo) ? casarItens(itensNota, itensPedido) : new Map<number, Par>();
  const comSaldo = itensPedido.filter((item) => item.quantidadeEmAberto > 0);
  const proporcional =
    !porValor && !temItens(tipo) && comSaldo.length === 1 && comSaldo[0].precoUnitario > 0 ? comSaldo[0] : null;

  const vinculos = itensPedido.map((pedido): VinculoSugerido => {
    const par = casamento.get(pedido.itemNumber);
    const itemNota = par ? itensNota.find((n) => n.indice === par.nota) : undefined;
    const temSaldo = pedido.quantidadeEmAberto > 0;

    let quantidade = pedido.quantidadeEmAberto;
    if (proporcional?.itemNumber === pedido.itemNumber) {
      quantidade = Math.min(valorNota / pedido.precoUnitario, pedido.quantidadeEmAberto);
    } else if (!porValor && itemNota?.quantidade && itemNota.quantidade > 0) {
      quantidade = Math.min(itemNota.quantidade, pedido.quantidadeEmAberto);
    }

    return {
      itemNumber: pedido.itemNumber,
      indiceNota: par?.nota ?? null,
      similaridade: par ? arredondar(par.score, 2) : null,
      quantidade: arredondar(quantidade),
      selecionado: temSaldo && (porValor || par !== undefined || proporcional?.itemNumber === pedido.itemNumber),
    };
  });

  let criterio: CriterioSelecao = "nenhum";
  if (porValor) criterio = "valor_total";
  else if (proporcional) criterio = "proporcional";
  else if (casamento.size > 0) criterio = "similaridade";
  return { vinculos, criterio };
}

// ---------- análise ----------

const PAPEIS: Record<TipoDocumento, { vendedor: string; comprador: string }> = {
  NFE: { vendedor: "emitente", comprador: "destinatário" },
  NFSE: { vendedor: "prestador", comprador: "tomador" },
  BOLETO: { vendedor: "beneficiário", comprador: "pagador" },
  FATURA: { vendedor: "concessionária", comprador: "cliente" },
};

/** Situações em que o pedido ainda aceita nota: não atendido e parcialmente atendido. */
const STATUS_EM_ABERTO = ["PENDING", "PARTIALLY_DELIVERED"] as const;

/** Fornecedor = credor com o CNPJ/CPF de quem vende; empresa = empresa com o CNPJ de quem compra. */
async function identificarPartes(documento: DocumentoLido): Promise<{ fornecedor: Parte | null; empresa: Parte | null; bloqueios: string[] }> {
  const papeis = PAPEIS[documento.tipoDocumento];
  const bloqueios: string[] = [];
  const docFornecedor = apenasDigitos(documento.fornecedorCnpj);
  const docComprador = apenasDigitos(documento.destinatarioCnpj);
  const [credor, empresas] = await Promise.all([
    docFornecedor ? buscarCredorPorDocumento(docFornecedor) : Promise.resolve(null),
    listarEmpresas(),
  ]);

  let fornecedor: Parte | null = null;
  if (!docFornecedor) {
    bloqueios.push(`Não foi possível ler o CNPJ/CPF do ${papeis.vendedor} no PDF.`);
  } else if (!credor) {
    bloqueios.push(
      `Nenhum fornecedor com CNPJ/CPF ${formatarDocumento(docFornecedor)} (${papeis.vendedor} do documento) está cadastrado no Sienge.`,
    );
  } else {
    fornecedor = { id: credor.id, nome: credor.name ?? credor.tradeName ?? "", cnpj: formatarDocumento(credor.cnpj ?? credor.cpf) };
  }

  let empresa: Parte | null = null;
  if (!docComprador) {
    bloqueios.push(`Não foi possível ler o CNPJ do ${papeis.comprador} no PDF.`);
  } else {
    const encontrada = empresas.find((e) => mesmoDocumento(e.cnpj, docComprador));
    if (!encontrada) {
      bloqueios.push(`O CNPJ do ${papeis.comprador} (${formatarDocumento(docComprador)}) não corresponde a nenhuma empresa do Sienge.`);
    } else {
      empresa = { id: encontrada.id, nome: encontrada.name ?? encontrada.tradeName ?? "", cnpj: formatarDocumento(encontrada.cnpj) };
    }
  }
  return { fornecedor, empresa, bloqueios };
}

/** Pedidos autorizados e em aberto do fornecedor, só da empresa do documento (a empresa do pedido é a da obra). */
async function listarPedidosEmAberto(fornecedorId: number, empresaId: number): Promise<{ pedidos: PedidoAberto[]; outraEmpresa: number }> {
  const porStatus = await Promise.all(
    STATUS_EM_ABERTO.map((status) => listarPedidos({ supplierId: fornecedorId, status, authorized: true })),
  );
  const candidatos = porStatus.flat().filter((p) => p.authorized === true && p.disapproved !== true && p.status !== "CANCELED");

  const idsObra = [...new Set(candidatos.map((p) => p.buildingId).filter((id): id is number => typeof id === "number"))];
  const obras = new Map<number, Empreendimento | null>(
    await Promise.all(idsObra.map(async (id) => [id, await buscarEmpreendimento(id)] as const)),
  );

  const pedidos: PedidoAberto[] = [];
  let outraEmpresa = 0;
  for (const pedido of candidatos) {
    const obra = pedido.buildingId ? obras.get(pedido.buildingId) : null;
    if (!obra || obra.companyId !== empresaId) {
      outraEmpresa += 1;
      continue;
    }
    pedidos.push({
      id: pedido.id,
      numero: pedido.formattedPurchaseOrderId ?? String(pedido.id),
      data: pedido.date ?? null,
      status: pedido.status as PedidoAberto["status"],
      obraId: pedido.buildingId ?? null,
      obraNome: obra.name ?? null,
      valorTotal: pedido.totalAmount ?? null,
    });
  }
  // Mais recentes primeiro.
  pedidos.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || b.id - a.id);
  return { pedidos, outraEmpresa };
}

/** Fornecedor e empresa do documento, e os pedidos em aberto entre os dois. Nada é gravado. */
export async function buscarPedidosDoDocumento(documento: DocumentoLido): Promise<AnaliseDocumento> {
  const { fornecedor, empresa, bloqueios } = await identificarPartes(documento);
  if (!fornecedor || !empresa) return { documento, fornecedor, empresa, pedidos: [], pedidosOutraEmpresa: 0, bloqueios };

  const { pedidos, outraEmpresa } = await listarPedidosEmAberto(fornecedor.id, empresa.id);
  if (pedidos.length === 0) {
    bloqueios.push(
      `Nenhum pedido de compra autorizado e em aberto (não atendido ou parcialmente atendido) do fornecedor ${fornecedor.nome} para a empresa ${empresa.nome}.` +
        (outraEmpresa > 0 ? ` Há ${outraEmpresa} pedido(s) em aberto deste fornecedor para outras empresas.` : ""),
    );
  }
  return { documento, fornecedor, empresa, pedidos, pedidosOutraEmpresa: outraEmpresa, bloqueios };
}

// ---------- pré-visualização ----------

/** Recebe o documento já lido na análise: o PDF não é lido de novo ao escolher o pedido. */
export async function montarPreview(entrada: { documento: DocumentoLido; purchaseOrderId: string; vencimentoEditavel: boolean }): Promise<PreviewNota> {
  const config = configSienge();
  const { documento } = entrada;
  const numeroPedido = normalizarNumeroPedido(entrada.purchaseOrderId, config.formatoPedido);
  const pedido = await carregarPedido(numeroPedido);

  const [{ itens: itensPedido }, obra, partes] = await Promise.all([
    carregarItensComSaldo(pedido.id),
    pedido.buildingId ? buscarEmpreendimento(pedido.buildingId) : Promise.resolve(null),
    identificarPartes(documento),
  ]);

  const tipo = documento.tipoDocumento;
  const { fornecedor, empresa } = partes;
  const bloqueios = [...partes.bloqueios];
  const avisos: string[] = [];

  if (fornecedor && fornecedor.id !== pedido.supplierId) {
    bloqueios.push(
      `O fornecedor do documento (${fornecedor.id} — ${fornecedor.nome}) é diferente do fornecedor do pedido ${numeroPedido.exibicao} (${pedido.supplierId}).`,
    );
  }
  if (typeof obra?.companyId !== "number") {
    bloqueios.push("Não foi possível identificar a empresa da obra do pedido para conferir com o documento.");
  } else if (empresa && obra.companyId !== empresa.id) {
    bloqueios.push(
      `A obra ${obra.id} (${obra.name ?? ""}) do pedido pertence à empresa ${obra.companyId}${obra.companyName ? ` — ${obra.companyName}` : ""}, mas o documento foi emitido para a empresa ${empresa.id} — ${empresa.nome}.`,
    );
  }

  const existentes = await listarNotasFiscais({
    supplierId: fornecedor?.id ?? pedido.supplierId,
    number: documento.numero,
    documentId: config.documentIds[tipo],
  });
  if (existentes.length > 0) {
    bloqueios.push(`O documento ${documento.numero} deste fornecedor já está cadastrado no Sienge (sequencial ${existentes[0].sequentialNumber}).`);
  }

  const aberto = valorEmAberto(itensPedido);
  if (itensPedido.every((item) => item.quantidadeEmAberto <= 0)) {
    bloqueios.push(`O pedido ${numeroPedido.exibicao} não tem saldo de entrega em aberto.`);
  }
  if (pedido.authorized !== true) bloqueios.push(`O pedido ${numeroPedido.exibicao} não está autorizado no Sienge.`);
  if (pedido.status !== "PENDING" && pedido.status !== "PARTIALLY_DELIVERED") {
    bloqueios.push(`O pedido ${numeroPedido.exibicao} não está em aberto (não atendido ou parcialmente atendido).`);
  }

  const itensNota: ItemNotaPreview[] = temItens(tipo) ? documento.itens.map((item, indice) => ({ indice, ...item })) : [];
  const { vinculos, criterio } = sugerirVinculos(tipo, itensNota, itensPedido, documento.valorTotal, aberto, toleranciaValor());

  const valores = `valor do documento ${formatarMoeda(documento.valorTotal)}, saldo em aberto do pedido ${formatarMoeda(aberto)}`;
  if (criterio === "proporcional") {
    const vinculo = vinculos.find((v) => v.selecionado);
    avisos.push(
      `${NOMES_TIPO[tipo]} não tem itens e o valor é diferente do saldo do pedido (${valores}). A quantidade do insumo ${vinculo?.itemNumber} foi calculada proporcionalmente ao valor. Confira.`,
    );
  } else if (criterio !== "valor_total" && aberto > 0) {
    avisos.push(
      temItens(tipo)
        ? `O valor não bate com o saldo do pedido (${valores}). Confira quais insumos e quantidades a nota atende.`
        : `${NOMES_TIPO[tipo]} não tem itens e o valor não bate com o saldo do pedido (${valores}). Selecione os insumos e as quantidades que ele atende.`,
    );
  }

  const associados = new Set(vinculos.map((v) => v.indiceNota).filter((i) => i !== null));
  for (const item of itensNota) {
    if (!associados.has(item.indice)) avisos.push(`O item da nota "${item.descricao}" não foi associado automaticamente a um insumo do pedido.`);
  }

  const hoje = hojeBrasil();
  return {
    pedido: {
      id: pedido.id,
      numero: numeroPedido.exibicao,
      status: pedido.status,
      obraId: pedido.buildingId ?? null,
      obraNome: obra?.name ?? null,
      valorEmAberto: aberto,
    },
    tipoDocumento: tipo,
    documentIds: config.documentIds,
    cabecalho: {
      numero: documento.numero,
      serie: documento.serie,
      dataEmissao: documento.dataEmissao,
      dataMovimento: hoje,
      vencimento: somarDias(hoje, DIAS_VENCIMENTO),
      vencimentoDocumento: documento.dataVencimento,
      valorTotal: documento.valorTotal,
      observacaoAutomatica: observacaoAutomatica(numeroPedido.exibicao),
    },
    fornecedorNota: { nome: documento.fornecedorNome, cnpj: formatarDocumento(documento.fornecedorCnpj) },
    destinatarioNota: { nome: documento.destinatarioNome, cnpj: formatarDocumento(documento.destinatarioCnpj) },
    fornecedor,
    empresa,
    itensNota,
    itensPedido,
    vinculos,
    criterioSelecao: criterio,
    vencimentoEditavel: entrada.vencimentoEditavel,
    bloqueios,
    avisos,
  };
}

// ---------- cadastro ----------

const FOLGA_QUANTIDADE = 1e-6;

/** Distribui a quantidade pedida pelas previsões de entrega do item, na ordem, até esgotar. */
function alocarEntregas(purchaseOrderId: number, itemNumber: number, quantidade: number, entregas: EntregaPrevista[]): EntregaVinculada[] {
  const alocadas: EntregaVinculada[] = [];
  let restante = quantidade;
  for (const entrega of entregas) {
    if (restante <= FOLGA_QUANTIDADE) break;
    const disponivel = Math.max(entrega.openQuantity ?? 0, 0);
    if (disponivel <= 0) continue;
    const usar = Math.min(disponivel, restante);
    alocadas.push({ purchaseOrderId, itemNumber, deliveryScheduleNumber: entrega.deliveryScheduleNumber, deliveredQuantity: arredondar(usar), keepBalance: true });
    restante -= usar;
  }
  if (restante > FOLGA_QUANTIDADE) {
    throw new ErroAplicacao("quantidade_invalida", `O insumo ${itemNumber} do pedido não tem saldo suficiente: faltam ${arredondar(restante)} unidades.`);
  }
  return alocadas;
}

/** Dados da gravação para o histórico (app_nf_cadastros). */
export interface ContextoCadastro {
  fornecedorId: number;
  empresaId: number;
  pedidoExibicao: string;
  obraNome: string | null;
}

/** Valida tudo de novo sem confiar na tela, grava a nota, vincula os insumos e ajusta o título. */
export async function confirmarCadastro(
  entrada: ConfirmacaoRequest,
  pdf: Uint8Array,
): Promise<ConfirmacaoResultado & { contexto: ContextoCadastro }> {
  const config = configSienge();
  const numeroPedido = normalizarNumeroPedido(entrada.purchaseOrderId, config.formatoPedido);
  const pedido = await carregarPedido(numeroPedido);

  if (typeof pedido.costCenterId !== "number") {
    throw new ErroAplicacao("centro_custo_divergente", `O pedido ${numeroPedido.exibicao} não tem centro de custo informado no Sienge.`);
  }
  if (entrada.centroCustoId !== pedido.costCenterId) {
    throw new ErroAplicacao(
      "centro_custo_divergente",
      `O centro de custo ${entrada.centroCustoId} não é o do pedido ${numeroPedido.exibicao}. Informe o mesmo centro de custo do pedido de compra.`,
    );
  }

  const obra = pedido.buildingId ? await buscarEmpreendimento(pedido.buildingId) : null;
  if (typeof obra?.companyId !== "number") {
    throw new ErroAplicacao("configuracao_invalida", "Não foi possível identificar a empresa da obra do pedido.", 422);
  }

  const existentes = await listarNotasFiscais({
    supplierId: pedido.supplierId,
    number: entrada.cabecalho.numero,
    documentId: config.documentIds[entrada.tipoDocumento],
  });
  if (existentes.length > 0) {
    throw new ErroAplicacao(
      "nota_duplicada",
      `O documento ${entrada.cabecalho.numero} deste fornecedor já está cadastrado no Sienge (sequencial ${existentes[0].sequentialNumber}).`,
      409,
    );
  }

  const { entregasPorItem } = await carregarItensComSaldo(pedido.id);
  const entregas = entrada.itens.flatMap((item) => {
    const previstas = entregasPorItem.get(item.itemNumber);
    if (!previstas) {
      throw new ErroAplicacao("quantidade_invalida", `O insumo ${item.itemNumber} não pertence ao pedido ${numeroPedido.exibicao}.`);
    }
    return alocarEntregas(pedido.id, item.itemNumber, item.quantidade, previstas);
  });

  const complemento = entrada.cabecalho.observacaoComplementar.trim();
  const criada = await criarNotaFiscal({
    documentId: config.documentIds[entrada.tipoDocumento],
    number: entrada.cabecalho.numero,
    series: entrada.cabecalho.serie ?? undefined,
    supplierId: pedido.supplierId,
    companyId: obra.companyId,
    movementTypeId: config.movementTypeId ?? undefined,
    movementDate: entrada.cabecalho.dataMovimento,
    issueDate: entrada.cabecalho.dataEmissao,
    notes: [observacaoAutomatica(numeroPedido.exibicao), complemento].filter(Boolean).join("\n"),
  });
  if (typeof criada?.sequentialNumber !== "number") {
    throw new ErroAplicacao("erro_sienge", "O Sienge criou a nota mas não devolveu o número sequencial.", 502);
  }
  const sequencial = criada.sequentialNumber;
  const contexto: ContextoCadastro = {
    fornecedorId: pedido.supplierId,
    empresaId: obra.companyId,
    pedidoExibicao: numeroPedido.exibicao,
    obraNome: obra.name ?? null,
  };

  try {
    await vincularEntregas(sequencial, entregas);
  } catch (causa) {
    const detalhe = causa instanceof ErroHttpSienge ? causa.message : String(causa);
    // O cabeçalho já foi gravado: a nota existe no Sienge, porém sem insumos.
    throw new ErroAplicacao(
      "itens_nao_vinculados",
      `A nota foi criada no Sienge (sequencial ${sequencial}), mas os insumos do pedido não puderam ser vinculados: ${detalhe} Conclua ou exclua a nota manualmente.`,
      502,
      { sequentialNumber: sequencial, contexto },
    );
  }

  const { billId, avisos } = await ajustarTitulo(sequencial, entrada, pdf);
  return {
    sequentialNumber: sequencial,
    billId,
    message: `Nota fiscal ${entrada.cabecalho.numero} cadastrada com sucesso (sequencial ${sequencial}).`,
    avisos,
    contexto,
  };
}

/**
 * Vencimento e anexo ficam no título gerado pela nota. A nota já está gravada neste ponto,
 * então falhas aqui viram aviso para ajuste manual em vez de erro.
 */
async function ajustarTitulo(sequencial: number, entrada: ConfirmacaoRequest, pdf: Uint8Array): Promise<{ billId: number | null; avisos: string[] }> {
  const avisos: string[] = [];
  let billId: number | null = null;
  try {
    billId = (await buscarNotaFiscal(sequencial))?.billId ?? null;
  } catch (causa) {
    avisos.push(`Não foi possível consultar o título da nota: ${mensagem(causa)}`);
  }
  if (!billId) {
    avisos.push("O Sienge ainda não gerou o título desta nota. Ajuste o vencimento da 1ª parcela e anexe o PDF manualmente.");
    return { billId: null, avisos };
  }

  try {
    const parcelas = await listarParcelas(billId);
    const primeira = [...parcelas].sort((a, b) => a.installmentNumber - b.installmentNumber)[0];
    if (!primeira) avisos.push(`O título ${billId} não tem parcelas; o vencimento não foi ajustado.`);
    else await alterarVencimento(billId, primeira.installmentNumber, entrada.cabecalho.vencimento);
  } catch (causa) {
    avisos.push(`Não foi possível ajustar o vencimento do título ${billId}: ${mensagem(causa)}`);
  }

  try {
    await anexarNoTitulo(billId, pdf, entrada.nomeArquivo, entrada.descricaoAnexo);
  } catch (causa) {
    avisos.push(`Não foi possível anexar o PDF ao título ${billId}: ${mensagem(causa)}`);
  }
  return { billId, avisos };
}

function mensagem(causa: unknown): string {
  return causa instanceof Error ? causa.message : String(causa);
}
