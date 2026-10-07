// Notas Fiscais › Título a Pagar: tipos trocados com a edge function app-nf (espelho de
// supabase/functions/app-nf/titulos.ts), chamadas à função e histórico (app_nf_titulos).
// Sem Supabase (modo demonstração) responde com dados de exemplo, para o fluxo inteiro poder ser navegado.
import { supabase } from './supabase';
import { invoke } from './api';
import { lerComoBase64, type DocumentoLido, type DocumentoSienge, type Parte, type TipoDocumento } from './nf';

export const MAX_OBSERVACAO_TITULO = 500;
export const MAX_PARCELAS = 120;
export const MAX_APROPRIACOES = 20;

export interface PlanoFinanceiro { id: string; nome: string }

export interface AnaliseTitulo {
  documento: DocumentoLido;
  fornecedor: Parte | null;
  empresa: Parte | null;
  empresaNaoLocalizada: boolean;
  documentIds: Record<TipoDocumento, string>;
  /** Documentos do Sienge (código e nome) para o seletor. */
  documentos: DocumentoSienge[];
  /** Planos financeiros já usados nos títulos, para sugerir na apropriação. */
  planos: PlanoFinanceiro[];
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

export interface Apropriacao { centroCustoId: number; planoFinanceiroId: string; percentual: number }
/** Apropriação de obra: item do orçamento com máscara (ex.: 01.004.002.001). */
export interface ApropriacaoObra { obraId: number; unidadeId: number; itemId: string; percentual: number }

/** Resposta de "titulo_orcamento": unidades construtivas da obra e, com a unidade, os itens apropriáveis. */
export interface OrcamentoObra {
  obraId: number;
  obraNome: string | null;
  unidades: { id: number; nome: string; bloqueada: boolean }[];
  unidadeId: number | null;
  itens: { codigo: string; nome: string; unidadeMedida: string | null }[];
}

/** Corpo de "titulo_cadastrar". Sem vencimentoManual, o servidor usa hoje + 17 dias. */
export interface TituloCorpo {
  fornecedorId: number;
  empresaId: number;
  tipoDocumento: TipoDocumento;
  documentId: string;
  numero: string;
  dataEmissao: string;
  dataCompetencia: string;
  dataBase: string;
  parcelas: number;
  valor: number;
  desconto: number;
  observacao: string;
  apropriacoes: Apropriacao[];
  apropriacoesObra: ApropriacaoObra[];
  pdfBase64: string;
  nomeArquivo: string;
  descricaoAnexo: string;
  vencimentoManual?: { data: string; senha: string };
}

export interface TituloResultado {
  billId: number | null;
  message: string;
  avisos: string[];
  tituloId?: string | null;
}

/** Linha do histórico (app_nf_titulos). */
export interface NfTitulo {
  id: string;
  criado_em: string;
  criado_por_email: string | null;
  tipo_documento: TipoDocumento;
  documento_sienge: string | null;
  numero: string;
  data_emissao: string | null;
  data_competencia: string | null;
  vencimento: string | null;
  parcelas: number;
  valor: number | null;
  desconto: number;
  fornecedor_nome: string | null;
  empresa_nome: string | null;
  bill_id: number | null;
  apropriacoes: { costCenterId: number; paymentCategoriesId: string; percentage: number }[];
  apropriacoes_obra: { buildingId: number; buildingUnitId: number; costEstimationSheetId: string; percentage: number }[] | null;
  avisos: string[];
  anexos: { descricao: string; nome: string; ok: boolean; erro?: string }[];
}

const fn = <T>(acao: string, corpo: Record<string, unknown> = {}) => invoke<T>('app-nf', { acao, ...corpo });

export const titulosApi = {
  /** Histórico: RLS libera para quem tem notas.titulos (ver) e acesso à empresa. */
  historico: async (): Promise<NfTitulo[]> => {
    if (!supabase) return demo.historico.slice();
    const { data, error } = await supabase.from('app_nf_titulos')
      .select('id, criado_em, criado_por_email, tipo_documento, documento_sienge, numero, data_emissao, data_competencia, vencimento, parcelas, valor, desconto, fornecedor_nome, empresa_nome, bill_id, apropriacoes, apropriacoes_obra, avisos, anexos')
      .is('excluida_no_sienge_em', null) // excluídos no Sienge ficam ocultos (o registro permanece para auditoria)
      .order('criado_em', { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data as NfTitulo[];
  },
  /** Lê o PDF e localiza credor e empresa pelo CNPJ. Nada é gravado. */
  analisar: (pdfBase64: string) => supabase ? fn<AnaliseTitulo>('titulo_analisar', { pdfBase64 }) : demo.espera(demo.analise()),
  /** Refaz a análise com a empresa informada pelo usuário (código no Sienge), sem reler o PDF. */
  empresa: (documento: DocumentoLido, empresaId: number) =>
    supabase ? fn<AnaliseTitulo>('titulo_empresa', { documento, empresaId }) : demo.espera(demo.analise(empresaId)),
  /** Unidades construtivas do orçamento da obra; com a unidade, também os itens do orçamento. */
  orcamento: (obraId: number, unidadeId?: number | null) =>
    supabase ? fn<OrcamentoObra>('titulo_orcamento', { obraId, unidadeId: unidadeId || undefined }) : demo.espera(demo.orcamento(obraId, unidadeId)),
  liberarVencimento: (senha: string) => supabase ? fn<{ ok: true }>('liberar_vencimento', { senha }) : demo.espera({ ok: true as const }),
  cadastrar: (corpo: TituloCorpo) => supabase ? fn<TituloResultado>('titulo_cadastrar', corpo as any) : demo.espera(demo.cadastrar(corpo)),
  /** Um anexo por chamada, depois que o Sienge gerou o título. */
  anexar: async (billId: number, arquivo: File, descricao: string, tituloId?: string | null) => {
    const pdfBase64 = await lerComoBase64(arquivo);
    if (!supabase) return demo.espera({ ok: true as const });
    return fn<{ ok: true }>('titulo_anexar', { billId, pdfBase64, nomeArquivo: arquivo.name, descricao, tituloId: tituloId || undefined });
  },
};

// ---------- modo demonstração ----------

const hoje = () => new Date().toISOString().slice(0, 10);
const somar = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const demo = {
  espera<T>(valor: T): Promise<T> {
    return new Promise(res => setTimeout(() => res(valor), 700));
  },
  historico: [
    { id: 'tp1', criado_em: '2026-10-02T13:20:00Z', criado_por_email: 'camila.ribeiro@horizonte.com.br', tipo_documento: 'FATURA', documento_sienge: 'FAT', numero: '884512', data_emissao: '2026-09-28', data_competencia: '2026-09-28', vencimento: '2026-10-19', parcelas: 1, valor: 2140.37, desconto: 0, fornecedor_nome: 'Equatorial Energia Goiás', empresa_nome: 'B2 Gestão e Operações', bill_id: 90310, apropriacoes: [{ costCenterId: 101, paymentCategoriesId: '201030101', percentage: 100 }], apropriacoes_obra: [], avisos: [], anexos: [{ descricao: 'FAT', nome: 'fatura-energia.pdf', ok: true }] },
    { id: 'tp2', criado_em: '2026-09-30T17:45:00Z', criado_por_email: 'rafael.andrade@horizonte.com.br', tipo_documento: 'NFSE', documento_sienge: 'NFSE', numero: '3104', data_emissao: '2026-09-29', data_competencia: '2026-09-01', vencimento: '2026-10-17', parcelas: 3, valor: 9600, desconto: 0, fornecedor_nome: 'Contabilidade Alfa Ltda', empresa_nome: 'SPE Jataí I – Libertá', bill_id: 90288, apropriacoes: [{ costCenterId: 190, paymentCategoriesId: '201040102', percentage: 60 }, { costCenterId: 191, paymentCategoriesId: '201040102', percentage: 40 }], apropriacoes_obra: [{ buildingId: 190, buildingUnitId: 1, costEstimationSheetId: '01.004.002.001', percentage: 100 }], avisos: ['Não foi possível anexar o PDF ao título 90288: arquivo recusado pelo Sienge.'], anexos: [{ descricao: 'NFS', nome: 'nfse-3104.pdf', ok: false, erro: 'arquivo recusado pelo Sienge' }] },
  ] as NfTitulo[],
  documento(): DocumentoLido {
    return {
      tipoDocumento: 'NFSE', numero: '3188', serie: null, dataEmissao: somar(hoje(), -1), dataVencimento: somar(hoje(), 20), valorTotal: 4250,
      fornecedorNome: 'CONTABILIDADE ALFA LTDA', fornecedorCnpj: '12345678000190', destinatarioNome: 'SPE JATAI I LIBERTA LTDA', destinatarioCnpj: '40111222000190',
      itens: [],
    };
  },
  analise(empresaId?: number): AnaliseTitulo {
    const doc = demo.documento();
    return {
      documento: doc,
      fornecedor: { id: 5210, nome: 'Contabilidade Alfa Ltda', cnpj: '12.345.678/0001-90' },
      empresa: { id: empresaId ?? 190, nome: 'SPE Jataí I – Libertá', cnpj: '40.111.222/0001-90' },
      empresaNaoLocalizada: false,
      documentIds: { NFE: 'NFE', NFSE: 'NFSE', BOLETO: 'BOL', FATURA: 'FAT' },
      documentos: [
        { id: 'BOL', nome: 'BOLETO' }, { id: 'FAT', nome: 'FATURA' }, { id: 'NFE', nome: 'NOTA FISCAL ELETRÔNICA' },
        { id: 'NFPJ', nome: 'NOTA FISCAL DE SERVIÇO ELETRÔNICA - PJ' }, { id: 'NFSE', nome: 'NOTA FISCAL DE SERVIÇO ELETRÔNICA' }, { id: 'REC', nome: 'RECIBO' },
      ],
      planos: [
        { id: '201030101', nome: 'Energia Elétrica' }, { id: '201030102', nome: 'Água e Esgoto' }, { id: '201030103', nome: 'Telefone e Internet' },
        { id: '201040101', nome: 'Assessoria Jurídica' }, { id: '201040102', nome: 'Assessoria Contábil' }, { id: '201050101', nome: 'Aluguéis' },
      ],
      cabecalho: {
        numero: doc.numero, dataEmissao: doc.dataEmissao!, dataCompetencia: doc.dataEmissao!, dataBase: doc.dataEmissao!,
        vencimento: somar(hoje(), 17), vencimentoDocumento: doc.dataVencimento, valorTotal: doc.valorTotal,
      },
      vencimentoEditavel: true,
      bloqueios: [],
      avisos: empresaId ? [`Empresa informada manualmente: ${empresaId}.`] : [],
    };
  },
  orcamento(obraId: number, unidadeId?: number | null): OrcamentoObra {
    const unidades = [{ id: 1, nome: 'CUSTOS INDIRETOS DE OBRA', bloqueada: false }, { id: 2, nome: 'CUSTOS DIRETOS DE OBRA', bloqueada: false }, { id: 3, nome: 'DESPESAS ADMINISTRATIVAS', bloqueada: true }];
    const itens = unidadeId ? [
      { codigo: '01.003.002.001', nome: 'Assessoria contábil', unidadeMedida: 'vb' }, { codigo: '01.004.002.001', nome: 'Energia elétrica do canteiro', unidadeMedida: 'mês' },
      { codigo: '01.018', nome: 'Taxas e emolumentos', unidadeMedida: 'vb' }, { codigo: '03.001.003', nome: 'Concreto usinado fck 30', unidadeMedida: 'm³' },
      { codigo: '05.001.007', nome: 'Alvenaria de vedação', unidadeMedida: 'm²' },
    ] : [];
    return { obraId, obraNome: `Obra ${obraId}`, unidades, unidadeId: unidadeId ?? null, itens };
  },
  cadastrar(corpo: TituloCorpo): TituloResultado {
    const billId = 90400 + demo.historico.length;
    demo.historico.unshift({
      id: 'tp' + Date.now(), criado_em: new Date().toISOString(), criado_por_email: 'camila.ribeiro@horizonte.com.br',
      tipo_documento: corpo.tipoDocumento, documento_sienge: corpo.documentId, numero: corpo.numero, data_emissao: corpo.dataEmissao,
      data_competencia: corpo.dataCompetencia, vencimento: corpo.vencimentoManual?.data || somar(hoje(), 17), parcelas: corpo.parcelas,
      valor: corpo.valor, desconto: corpo.desconto, fornecedor_nome: 'Contabilidade Alfa Ltda', empresa_nome: 'SPE Jataí I – Libertá', bill_id: billId,
      apropriacoes: corpo.apropriacoes.map(a => ({ costCenterId: a.centroCustoId, paymentCategoriesId: a.planoFinanceiroId, percentage: a.percentual })),
      apropriacoes_obra: corpo.apropriacoesObra.map(a => ({ buildingId: a.obraId, buildingUnitId: a.unidadeId, costEstimationSheetId: a.itemId, percentage: a.percentual })),
      avisos: [], anexos: [{ descricao: corpo.descricaoAnexo, nome: corpo.nomeArquivo, ok: true }],
    });
    return { billId, message: `Título ${billId} cadastrado com sucesso no contas a pagar.`, avisos: [], tituloId: null };
  },
};
