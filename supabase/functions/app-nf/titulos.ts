// Notas Fiscais › Título a Pagar: cadastro direto do título do contas a pagar no Sienge
// (POST /v1/bills) a partir do PDF, sem pedido de compra nem nota fiscal de compra.
// Os tipos trocados com a tela estão duplicados em app/src/lib/nfTitulos.ts.

import {
  anexarNoTitulo,
  buscarCentroCusto,
  buscarCredor,
  buscarDocumento,
  buscarEmpreendimento,
  buscarPlanoFinanceiro,
  configSienge,
  criarTitulo,
  DIAS_VENCIMENTO,
  ErroAplicacao,
  indexadorTitulo,
  listarEmpresas,
  listarItensOrcamento,
  listarTitulos,
  listarUnidadesConstrutivas,
  senhaVencimento,
} from "./sienge.ts";
import type { ApropriacaoFinanceira, ApropriacaoObra, ItemOrcamento, TipoDocumento, TituloResumo, UnidadeConstrutiva } from "./sienge.ts";
import { hojeBrasil, identificarPartes, somarDias } from "./regras.ts";
import type { DocumentoLido, Parte } from "./regras.ts";

/** Limites do POST /v1/bills. */
export const MAX_OBSERVACAO_TITULO = 500;
export const MAX_PARCELAS = 120;
export const MAX_APROPRIACOES = 20;
export const MAX_VALOR_TITULO = 9_999_999_999.99;

const OBSERVACAO_AUTOMATICA = "Título cadastrado via Externo.";

export interface AnaliseTitulo {
  documento: DocumentoLido;
  fornecedor: Parte | null;
  empresa: Parte | null;
  empresaNaoLocalizada: boolean;
  documentIds: Record<TipoDocumento, string>;
  cabecalho: {
    numero: string;
    dataEmissao: string;
    dataCompetencia: string;
    dataBase: string;
    vencimento: string;
    vencimentoDocumento: string | null;
    valorTotal: number;
  };
  vencimentoEditavel: boolean;
  bloqueios: string[];
  avisos: string[];
}

export interface TituloRequest {
  fornecedorId: number;
  empresaId: number;
  tipoDocumento: TipoDocumento;
  documentId: string;
  numero: string;
  dataEmissao: string;
  dataCompetencia: string;
  dataBase: string;
  vencimento: string;
  parcelas: number;
  valor: number;
  desconto: number;
  observacao: string;
  apropriacoes: ApropriacaoFinanceira[];
  /** Apropriação de obra (buildingsCost); vazia não é enviada. */
  apropriacoesObra: ApropriacaoObra[];
  pdfBase64: string;
  nomeArquivo: string;
  descricaoAnexo: string;
}

export interface TituloResultado {
  billId: number | null;
  message: string;
  avisos: string[];
}

/** Dados da gravação para o histórico (app_nf_titulos). */
export interface ContextoTitulo {
  fornecedorNome: string | null;
  empresaNome: string | null;
}

/**
 * O filtro de período do GET /v1/bills é obrigatório; a janela larga cobre emissão e vencimento
 * para achar o mesmo documento já lançado.
 */
function janelaBusca(dataEmissao: string): { startDate: string; endDate: string } {
  const hoje = hojeBrasil();
  const inicio = dataEmissao < hoje ? dataEmissao : hoje;
  return { startDate: somarDias(inicio, -730), endDate: somarDias(hoje, 730) };
}

function mesmoNumero(a: string | undefined, b: string): boolean {
  return (a ?? "").trim().replace(/^0+/, "").toUpperCase() === b.trim().replace(/^0+/, "").toUpperCase();
}

async function titulosDoDocumento(creditorId: number, numero: string, dataEmissao: string, debtorId?: number): Promise<TituloResumo[]> {
  const titulos = await listarTitulos({ ...janelaBusca(dataEmissao), creditorId, debtorId, documentNumber: numero });
  return titulos.filter((t) => (t.creditorId === undefined || t.creditorId === creditorId) && mesmoNumero(t.documentNumber, numero));
}

// ---------- orçamento da obra (seletores da apropriação de obra) ----------

const CACHE_ORCAMENTO_MS = 5 * 60_000;
const cacheUnidades = new Map<number, { em: number; lista: UnidadeConstrutiva[] | null }>();
const cacheItens = new Map<string, { em: number; lista: ItemOrcamento[] }>();

async function unidadesDaObra(obraId: number): Promise<UnidadeConstrutiva[] | null> {
  const guardado = cacheUnidades.get(obraId);
  if (guardado && Date.now() - guardado.em < CACHE_ORCAMENTO_MS) return guardado.lista;
  const lista = await listarUnidadesConstrutivas(obraId);
  cacheUnidades.set(obraId, { em: Date.now(), lista });
  return lista;
}

async function itensDaUnidade(obraId: number, unidadeId: number): Promise<ItemOrcamento[]> {
  const chave = `${obraId}|${unidadeId}`;
  const guardado = cacheItens.get(chave);
  if (guardado && Date.now() - guardado.em < CACHE_ORCAMENTO_MS) return guardado.lista;
  const lista = await listarItensOrcamento(obraId, unidadeId);
  cacheItens.set(chave, { em: Date.now(), lista });
  return lista;
}

export interface UnidadeObra { id: number; nome: string; bloqueada: boolean }
export interface ItemObra { codigo: string; nome: string; unidadeMedida: string | null }

/**
 * Itens que recebem apropriação: os que não agrupam outros (nenhum outro código começa com "<código>.").
 * No Sienge só se apropria em item analítico, nunca no grupo.
 */
function itensAnaliticos(itens: ItemOrcamento[]): ItemObra[] {
  const codigos = itens.map((i) => (i.wbsCode ?? "").trim()).filter(Boolean);
  return itens
    .filter((i) => {
      const codigo = (i.wbsCode ?? "").trim();
      return !!codigo && !codigos.some((c) => c.startsWith(`${codigo}.`));
    })
    .map((i) => ({ codigo: (i.wbsCode ?? "").trim(), nome: (i.description ?? "").trim(), unidadeMedida: i.unitOfMeasure ?? null }));
}

/** Unidades construtivas do orçamento da obra e, com a unidade, os itens apropriáveis. Nada é gravado. */
export async function orcamentoDaObra(obraId: number, unidadeId?: number | null): Promise<{
  obraId: number;
  obraNome: string | null;
  unidades: UnidadeObra[];
  unidadeId: number | null;
  itens: ItemObra[];
}> {
  const [unidades, obra] = await Promise.all([unidadesDaObra(obraId), buscarEmpreendimento(obraId).catch(() => null)]);
  if (unidades === null) throw new ErroAplicacao("requisicao_invalida", `A obra ${obraId} não existe no Sienge ou não tem orçamento.`, 404);
  const unidade = unidadeId ? unidades.find((u) => u.id === unidadeId) : null;
  if (unidadeId && !unidade) {
    throw new ErroAplicacao("requisicao_invalida", `A unidade construtiva ${unidadeId} não existe no orçamento da obra ${obraId}.`, 404);
  }
  return {
    obraId,
    obraNome: obra?.name ?? null,
    unidades: unidades.map((u) => ({ id: u.id, nome: (u.description ?? "").trim() || `Unidade ${u.id}`, bloqueada: u.status === "LOCKED" })),
    unidadeId: unidade?.id ?? null,
    itens: unidade ? itensAnaliticos(await itensDaUnidade(obraId, unidade.id)) : [],
  };
}

/** Confere no orçamento do Sienge cada obra, unidade construtiva e item da apropriação de obra. */
async function conferirApropriacoesObra(apropriacoes: ApropriacaoObra[]): Promise<void> {
  const obras = [...new Set(apropriacoes.map((a) => a.buildingId))];
  const unidadesPorObra = new Map(await Promise.all(obras.map(async (id) => [id, await unidadesDaObra(id)] as const)));
  for (const a of apropriacoes) {
    const unidades = unidadesPorObra.get(a.buildingId);
    if (!unidades) throw new ErroAplicacao("requisicao_invalida", `A obra ${a.buildingId} não existe no Sienge ou não tem orçamento.`);
    if (!unidades.some((u) => u.id === a.buildingUnitId)) {
      throw new ErroAplicacao("requisicao_invalida", `A unidade construtiva ${a.buildingUnitId} não existe no orçamento da obra ${a.buildingId}.`);
    }
  }
  const pares = [...new Set(apropriacoes.map((a) => `${a.buildingId}|${a.buildingUnitId}`))];
  const itensPorPar = new Map(await Promise.all(pares.map(async (par) => {
    const [obra, unidade] = par.split("|").map(Number);
    return [par, itensAnaliticos(await itensDaUnidade(obra, unidade))] as const;
  })));
  for (const a of apropriacoes) {
    const itens = itensPorPar.get(`${a.buildingId}|${a.buildingUnitId}`) ?? [];
    if (!itens.some((i) => i.codigo === a.costEstimationSheetId)) {
      throw new ErroAplicacao(
        "requisicao_invalida",
        `O item ${a.costEstimationSheetId} não é um item apropriável da unidade ${a.buildingUnitId} da obra ${a.buildingId}.`,
      );
    }
  }
}

function mensagem(causa: unknown): string {
  return causa instanceof Error ? causa.message : String(causa);
}

/** Credor e empresa do documento e os dados sugeridos do título. Nada é gravado. */
export async function analisarTitulo(documento: DocumentoLido, empresaIdManual?: number | null): Promise<AnaliseTitulo> {
  const { fornecedor, empresa, bloqueioFornecedor, bloqueios, avisos } = await identificarPartes(documento, empresaIdManual);
  if (bloqueioFornecedor) bloqueios.unshift(bloqueioFornecedor);

  const hoje = hojeBrasil();
  const dataEmissao = documento.dataEmissao ?? hoje;
  if (!documento.dataEmissao) avisos.push("A data de emissão não foi lida no PDF: foi usada a data de hoje. Confira.");

  if (fornecedor) {
    try {
      const existentes = await titulosDoDocumento(fornecedor.id, documento.numero, dataEmissao, empresa?.id);
      if (existentes.length) {
        avisos.push(`Já existe no Sienge o título ${existentes[0].id} com o documento ${documento.numero} deste credor. Confira antes de cadastrar.`);
      }
    } catch (causa) {
      avisos.push(`Não foi possível verificar se o título já existe no Sienge: ${mensagem(causa)}`);
    }
  }

  return {
    documento,
    fornecedor,
    empresa,
    empresaNaoLocalizada: !empresa,
    documentIds: configSienge().documentIds,
    cabecalho: {
      numero: documento.numero,
      dataEmissao,
      dataCompetencia: dataEmissao,
      dataBase: dataEmissao,
      vencimento: somarDias(hoje, DIAS_VENCIMENTO),
      vencimentoDocumento: documento.dataVencimento,
      valorTotal: documento.valorTotal,
    },
    vencimentoEditavel: !!senhaVencimento(),
    bloqueios,
    avisos,
  };
}

/** Valida tudo de novo no Sienge sem confiar na tela, grava o título e anexa o PDF. */
export async function confirmarTitulo(
  entrada: TituloRequest,
  pdf: Uint8Array,
  /** Acesso do usuário à empresa do título (app_pode_empresa). */
  podeEmpresa: (empresaId: number) => Promise<boolean>,
): Promise<TituloResultado & { contexto: ContextoTitulo }> {
  if (!(await podeEmpresa(entrada.empresaId))) {
    throw new ErroAplicacao("sem_permissao", `Seu usuário não tem acesso à empresa ${entrada.empresaId}.`, 403);
  }

  const centros = [...new Set(entrada.apropriacoes.map((a) => a.costCenterId))];
  const planos = [...new Set(entrada.apropriacoes.map((a) => a.paymentCategoriesId))];
  const [credor, empresas, documento, achadosCentros, achadosPlanos] = await Promise.all([
    buscarCredor(entrada.fornecedorId),
    listarEmpresas(),
    buscarDocumento(entrada.documentId),
    Promise.all(centros.map(async (id) => [id, await buscarCentroCusto(id)] as const)),
    Promise.all(planos.map(async (id) => [id, await buscarPlanoFinanceiro(id)] as const)),
  ]);

  if (!credor) throw new ErroAplicacao("requisicao_invalida", `Nenhum credor com o código ${entrada.fornecedorId} no Sienge.`);
  const empresa = empresas.find((e) => e.id === entrada.empresaId);
  if (!empresa) throw new ErroAplicacao("requisicao_invalida", `Nenhuma empresa com o código ${entrada.empresaId} no Sienge.`);
  if (!documento) {
    throw new ErroAplicacao("requisicao_invalida", `O documento ${entrada.documentId} não existe no Sienge. Escolha outro tipo de documento.`);
  }
  const centroInexistente = achadosCentros.find(([, c]) => !c);
  if (centroInexistente) throw new ErroAplicacao("requisicao_invalida", `O centro de custo ${centroInexistente[0]} não existe no Sienge.`);
  const planoInexistente = achadosPlanos.find(([, p]) => !p);
  if (planoInexistente) throw new ErroAplicacao("requisicao_invalida", `O plano financeiro ${planoInexistente[0]} não existe no Sienge.`);

  await conferirApropriacoesObra(entrada.apropriacoesObra);

  const existentes = await titulosDoDocumento(credor.id, entrada.numero, entrada.dataEmissao, empresa.id);
  if (existentes.length) {
    throw new ErroAplicacao(
      "titulo_duplicado",
      `O documento ${entrada.numero} deste credor já está lançado no Sienge (título ${existentes[0].id}).`,
      409,
    );
  }

  const complemento = entrada.observacao.trim();
  const notes = [OBSERVACAO_AUTOMATICA, complemento].filter(Boolean).join("\n").slice(0, MAX_OBSERVACAO_TITULO);
  let billId = await criarTitulo({
    debtorId: empresa.id,
    creditorId: credor.id,
    documentIdentificationId: entrada.documentId,
    documentNumber: entrada.numero,
    issueDate: entrada.dataEmissao,
    baseDate: entrada.dataBase,
    billDate: entrada.dataCompetencia,
    dueDate: entrada.vencimento,
    indexId: indexadorTitulo(),
    installmentsNumber: entrada.parcelas,
    totalInvoiceAmount: entrada.valor,
    discount: entrada.desconto,
    notes,
    budgetCategories: entrada.apropriacoes,
    ...(entrada.apropriacoesObra.length ? { buildingsCost: entrada.apropriacoesObra } : {}),
  });

  const avisos: string[] = [];
  if (!billId) {
    // O título já foi gravado: falhas daqui em diante viram aviso para ajuste manual.
    try {
      const criados = await titulosDoDocumento(credor.id, entrada.numero, entrada.dataEmissao, empresa.id);
      billId = criados.reduce<number | null>((maior, t) => (maior === null || t.id > maior ? t.id : maior), null);
    } catch (causa) {
      avisos.push(`Não foi possível consultar o número do título criado: ${mensagem(causa)}`);
    }
  }
  if (!billId) {
    avisos.push("O Sienge criou o título, mas não informou o número. Localize-o no Sienge e anexe o PDF manualmente.");
  } else {
    try {
      await anexarNoTitulo(billId, pdf, entrada.nomeArquivo, entrada.descricaoAnexo);
    } catch (causa) {
      avisos.push(`Não foi possível anexar o PDF ao título ${billId}: ${mensagem(causa)}`);
    }
  }

  return {
    billId,
    message: billId
      ? `Título ${billId} cadastrado com sucesso no contas a pagar.`
      : `Título do documento ${entrada.numero} cadastrado no contas a pagar.`,
    avisos,
    contexto: {
      fornecedorNome: credor.name ?? credor.tradeName ?? null,
      empresaNome: empresa.name ?? empresa.tradeName ?? null,
    },
  };
}
