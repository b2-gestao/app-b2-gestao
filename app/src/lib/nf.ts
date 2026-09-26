// Notas Fiscais › Cadastros: tipos trocados com a edge function app-nf (espelho de
// supabase/functions/app-nf/regras.ts), chamadas à função, histórico (app_nf_cadastros)
// e leitura de arquivos no navegador. Sem Supabase (modo demonstração) responde com dados
// de exemplo, para o fluxo inteiro poder ser navegado.
import { supabase } from './supabase';
import { invoke } from './api';

export type TipoDocumento = 'NFE' | 'NFSE' | 'BOLETO' | 'FATURA';

export const NOMES_TIPO: Record<TipoDocumento, string> = {
  NFE: 'NF-e (nota de produto)',
  NFSE: 'NFS-e (nota de serviço)',
  BOLETO: 'Boleto',
  FATURA: 'Fatura (água, energia, internet)',
};

/** Descrição curta usada nos anexos do título, no padrão já usado no Sienge ("NF", "BLT"). */
export const SIGLAS_ANEXO: Record<TipoDocumento, string> = { NFE: 'NF', NFSE: 'NFS', BOLETO: 'BLT', FATURA: 'FAT' };

export const PAPEIS: Record<TipoDocumento, { vendedor: string; comprador: string }> = {
  NFE: { vendedor: 'emitente', comprador: 'destinatário' },
  NFSE: { vendedor: 'prestador', comprador: 'tomador' },
  BOLETO: { vendedor: 'beneficiário', comprador: 'pagador' },
  FATURA: { vendedor: 'concessionária', comprador: 'cliente' },
};

export const MAX_DESCRICAO_ANEXO = 500;
/** ~3 MB: o PDF vai em base64 (+33%) no corpo da chamada. */
export const MAX_BYTES_PDF = 3_000_000;

/** Só a NF-e traz itens com descrição; nos demais o vínculo é feito pelo valor. */
export function temItens(tipo: TipoDocumento): boolean {
  return tipo === 'NFE';
}

export interface DocumentoLido {
  tipoDocumento: TipoDocumento;
  numero: string;
  serie: string | null;
  dataEmissao: string | null;
  dataVencimento: string | null;
  valorTotal: number;
  fornecedorNome: string | null;
  fornecedorCnpj: string | null;
  destinatarioNome: string | null;
  destinatarioCnpj: string | null;
  itens: Array<{
    codigo: string | null;
    descricao: string;
    ncm: string | null;
    unidade: string | null;
    quantidade: number | null;
    valorUnitario: number | null;
    valorTotal: number | null;
  }>;
}

export interface Parte { id: number; nome: string; cnpj: string | null }

export interface PedidoAberto {
  id: number;
  numero: string;
  data: string | null;
  status: 'PENDING' | 'PARTIALLY_DELIVERED';
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

export type CriterioSelecao = 'valor_total' | 'similaridade' | 'proporcional' | 'nenhum';

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
  vencimentoEditavel: boolean;
  bloqueios: string[];
  avisos: string[];
}

/** Corpo de "cadastrar". Sem vencimentoManual, o servidor usa hoje + 17 dias. */
export interface ConfirmacaoCorpo {
  purchaseOrderId: string;
  tipoDocumento: TipoDocumento;
  pdfBase64: string;
  nomeArquivo: string;
  descricaoAnexo: string;
  centroCustoId: number;
  cabecalho: { numero: string; serie: string | null; dataEmissao: string; dataMovimento: string; observacaoComplementar: string };
  itens: Array<{ itemNumber: number; quantidade: number }>;
  vencimentoManual?: { data: string; senha: string };
  /** Só para o histórico (app_nf_cadastros). */
  fornecedorNome?: string | null;
  empresaNome?: string | null;
  valor?: number;
}

export interface ConfirmacaoResultado {
  sequentialNumber: number;
  billId: number | null;
  message: string;
  avisos: string[];
  cadastroId?: string | null;
}

/** Linha do histórico (app_nf_cadastros). */
export interface NfCadastro {
  id: string;
  criado_em: string;
  criado_por_email: string | null;
  situacao: 'cadastrada' | 'itens_nao_vinculados';
  tipo_documento: TipoDocumento;
  numero: string;
  serie: string | null;
  data_emissao: string | null;
  vencimento: string | null;
  valor: number | null;
  fornecedor_nome: string | null;
  empresa_nome: string | null;
  pedido: string;
  obra_nome: string | null;
  sequencial: number;
  bill_id: number | null;
  avisos: string[];
  anexos: { descricao: string; nome: string; ok: boolean; erro?: string }[];
}

// ---------- arquivos (navegador) ----------

export function lerComoBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const resultado = String(leitor.result ?? '');
      resolve(resultado.slice(resultado.indexOf(',') + 1));
    };
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Identifica o conteúdo do arquivo, para achar o mesmo PDF mesmo com outro nome.
 * Sem crypto.subtle (página fora de HTTPS), cai para o tamanho em bytes.
 */
export async function impressaoDigital(arquivo: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return `tamanho:${arquivo.size}`;
  const resumo = new Uint8Array(await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer()));
  return Array.from(resumo, b => b.toString(16).padStart(2, '0')).join('');
}

/** Unidades decimais, para o limite de 3.000.000 bytes aparecer como "3 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} MB`;
}

// ---------- chamadas ----------

const fn = <T>(acao: string, corpo: Record<string, unknown> = {}) => invoke<T>('app-nf', { acao, ...corpo });

export const nfApi = {
  /** Histórico: RLS libera para quem tem notas.cadastros (ver). */
  historico: async (): Promise<NfCadastro[]> => {
    if (!supabase) return demo.historico.slice();
    const { data, error } = await supabase.from('app_nf_cadastros')
      .select('id, criado_em, criado_por_email, situacao, tipo_documento, numero, serie, data_emissao, vencimento, valor, fornecedor_nome, empresa_nome, pedido, obra_nome, sequencial, bill_id, avisos, anexos')
      .order('criado_em', { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data as NfCadastro[];
  },
  /** Lê o PDF e traz os pedidos em aberto do fornecedor para a empresa. Nada é gravado. */
  analisar: (pdfBase64: string) => supabase ? fn<AnaliseDocumento>('analisar', { pdfBase64 }) : demo.espera(demo.analise()),
  /** O documento já lido volta para o servidor: o PDF não é lido de novo. */
  preview: (documento: DocumentoLido, purchaseOrderId: string) =>
    supabase ? fn<PreviewNota>('preview', { documento, purchaseOrderId }) : demo.espera(demo.preview(purchaseOrderId)),
  liberarVencimento: (senha: string) => supabase ? fn<{ ok: true }>('liberar_vencimento', { senha }) : demo.espera({ ok: true as const }),
  cadastrar: (corpo: ConfirmacaoCorpo) => supabase ? fn<ConfirmacaoResultado>('cadastrar', corpo as any) : demo.espera(demo.cadastrar(corpo)),
  /** Um anexo por chamada, depois que o Sienge gerou o título. */
  anexar: async (billId: number, arquivo: File, descricao: string, cadastroId?: string | null) => {
    const pdfBase64 = await lerComoBase64(arquivo);
    if (!supabase) return demo.espera({ ok: true as const });
    return fn<{ ok: true }>('anexar', { billId, pdfBase64, nomeArquivo: arquivo.name, descricao, cadastroId: cadastroId || undefined });
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
    { id: 'nf1', criado_em: '2026-09-24T14:12:00Z', criado_por_email: 'camila.ribeiro@horizonte.com.br', situacao: 'cadastrada', tipo_documento: 'NFE', numero: '13902', serie: '1', data_emissao: '2026-09-22', vencimento: '2026-10-11', valor: 4870.5, fornecedor_nome: 'Deca Louças e Metais Ltda', empresa_nome: 'SPE Jataí I – Libertá', pedido: '93410', obra_nome: 'Residencial Libertá', sequencial: 55821, bill_id: 90112, avisos: [], anexos: [{ descricao: 'NF', nome: 'danfe-13902.pdf', ok: true }, { descricao: 'BLT', nome: 'boleto-13902.pdf', ok: true }] },
    { id: 'nf2', criado_em: '2026-09-23T10:40:00Z', criado_por_email: 'rafael.andrade@horizonte.com.br', situacao: 'cadastrada', tipo_documento: 'NFSE', numero: '2291', serie: null, data_emissao: '2026-09-20', vencimento: '2026-10-10', valor: 12500, fornecedor_nome: 'Empreiteira Alvenaria Sul', empresa_nome: 'SPE Rio Verde I – Laguna', pedido: '93377', obra_nome: 'Residencial Laguna', sequencial: 55790, bill_id: 90087, avisos: ['Não foi possível ajustar o vencimento do título 90087: parcela já autorizada.'], anexos: [{ descricao: 'NFS', nome: 'nfse-2291.pdf', ok: true }] },
    { id: 'nf3', criado_em: '2026-09-22T16:05:00Z', criado_por_email: 'camila.ribeiro@horizonte.com.br', situacao: 'itens_nao_vinculados', tipo_documento: 'FATURA', numero: '884120', serie: null, data_emissao: '2026-09-18', vencimento: '2026-10-09', valor: 1834.22, fornecedor_nome: 'Equatorial Energia Goiás', empresa_nome: 'B2 Gestão e Operações', pedido: '93301', obra_nome: 'Sede administrativa', sequencial: 55744, bill_id: null, avisos: ['A nota foi criada no Sienge (sequencial 55744), mas os insumos do pedido não puderam ser vinculados.'], anexos: [] },
  ] as NfCadastro[],
  documento(): DocumentoLido {
    return {
      tipoDocumento: 'NFE', numero: '14027', serie: '1', dataEmissao: somar(hoje(), -2), dataVencimento: somar(hoje(), 28), valorTotal: 6384.9,
      fornecedorNome: 'DECA LOUCAS E METAIS LTDA', fornecedorCnpj: '61092037000160', destinatarioNome: 'SPE JATAI I LIBERTA LTDA', destinatarioCnpj: '40111222000190',
      itens: [
        { codigo: 'CB40', descricao: 'CUBA SOBREPOR QUADRADA COM MESA 40CM BR', ncm: '69109000', unidade: 'UN', quantidade: 12, valorUnitario: 289.9, valorTotal: 3478.8 },
        { codigo: 'MT11', descricao: 'MISTURADOR MONOCOMANDO LAVATORIO CR', ncm: '84818019', unidade: 'UN', quantidade: 6, valorUnitario: 402.35, valorTotal: 2414.1 },
        { codigo: null, descricao: 'FRETE E EMBALAGEM', ncm: null, unidade: 'SV', quantidade: 1, valorUnitario: 492, valorTotal: 492 },
      ],
    };
  },
  analise(): AnaliseDocumento {
    return {
      documento: demo.documento(),
      fornecedor: { id: 4102, nome: 'Deca Louças e Metais Ltda', cnpj: '61.092.037/0001-60' },
      empresa: { id: 190, nome: 'SPE Jataí I – Libertá', cnpj: '40.111.222/0001-90' },
      pedidos: [
        { id: 93410, numero: '93410', data: somar(hoje(), -9), status: 'PARTIALLY_DELIVERED', obraId: 1901, obraNome: 'Residencial Libertá', valorTotal: 18920 },
        { id: 93388, numero: '93388', data: somar(hoje(), -21), status: 'PENDING', obraId: 1901, obraNome: 'Residencial Libertá', valorTotal: 7240 },
      ],
      pedidosOutraEmpresa: 1,
      bloqueios: [],
    };
  },
  preview(purchaseOrderId: string): PreviewNota {
    const doc = demo.documento();
    const itensNota = doc.itens.map((it, indice) => ({ indice, ...it }));
    const itensPedido: ItemPedidoPreview[] = [
      { itemNumber: 1, codigoInsumo: '143', descricao: 'CUBA DE SOBREPOR QUADRADA DECA NA COR BRANCA', unidade: 'UN', quantidadePedido: 40, quantidadeEmAberto: 28, precoUnitario: 289.9 },
      { itemNumber: 2, codigoInsumo: '219', descricao: 'MISTURADOR MONOCOMANDO PARA LAVATÓRIO CROMADO', unidade: 'UN', quantidadePedido: 20, quantidadeEmAberto: 14, precoUnitario: 402.35 },
      { itemNumber: 3, codigoInsumo: '377', descricao: 'VÁLVULA DE ESCOAMENTO CLICK 1 POL', unidade: 'UN', quantidadePedido: 40, quantidadeEmAberto: 0, precoUnitario: 61.5 },
    ];
    const dataMovimento = hoje();
    return {
      pedido: { id: Number(purchaseOrderId), numero: purchaseOrderId, status: 'PARTIALLY_DELIVERED', obraId: 1901, obraNome: 'Residencial Libertá', valorEmAberto: 13750.1 },
      tipoDocumento: doc.tipoDocumento,
      documentIds: { NFE: 'NFE', NFSE: 'NFSE', BOLETO: 'BOL', FATURA: 'FAT' },
      cabecalho: {
        numero: doc.numero, serie: doc.serie, dataEmissao: doc.dataEmissao, dataMovimento, vencimento: somar(dataMovimento, 17),
        vencimentoDocumento: doc.dataVencimento, valorTotal: doc.valorTotal,
        observacaoAutomatica: `Pedido de compra ${purchaseOrderId} vinculado a esta nota. Cadastrado via Externo.`,
      },
      fornecedorNota: { nome: doc.fornecedorNome, cnpj: '61.092.037/0001-60' },
      destinatarioNota: { nome: doc.destinatarioNome, cnpj: '40.111.222/0001-90' },
      fornecedor: { id: 4102, nome: 'Deca Louças e Metais Ltda', cnpj: '61.092.037/0001-60' },
      empresa: { id: 190, nome: 'SPE Jataí I – Libertá', cnpj: '40.111.222/0001-90' },
      itensNota,
      itensPedido,
      vinculos: [
        { itemNumber: 1, indiceNota: 0, similaridade: 0.63, quantidade: 12, selecionado: true },
        { itemNumber: 2, indiceNota: 1, similaridade: 0.81, quantidade: 6, selecionado: true },
        { itemNumber: 3, indiceNota: null, similaridade: null, quantidade: 0, selecionado: false },
      ],
      criterioSelecao: 'similaridade',
      vencimentoEditavel: true,
      bloqueios: [],
      avisos: [
        'O valor não bate com o saldo do pedido (valor do documento R$ 6.384,90, saldo em aberto do pedido R$ 13.750,10). Confira quais insumos e quantidades a nota atende.',
        'O item da nota "FRETE E EMBALAGEM" não foi associado automaticamente a um insumo do pedido.',
      ],
    };
  },
  cadastrar(corpo: ConfirmacaoCorpo): ConfirmacaoResultado {
    const sequentialNumber = 55900 + demo.historico.length;
    const billId = 90200 + demo.historico.length;
    demo.historico.unshift({
      id: 'nf' + Date.now(), criado_em: new Date().toISOString(), criado_por_email: 'camila.ribeiro@horizonte.com.br', situacao: 'cadastrada',
      tipo_documento: corpo.tipoDocumento, numero: corpo.cabecalho.numero, serie: corpo.cabecalho.serie, data_emissao: corpo.cabecalho.dataEmissao,
      vencimento: corpo.vencimentoManual?.data || somar(hoje(), 17), valor: corpo.valor ?? null, fornecedor_nome: corpo.fornecedorNome ?? null,
      empresa_nome: corpo.empresaNome ?? null, pedido: corpo.purchaseOrderId, obra_nome: 'Residencial Libertá', sequencial: sequentialNumber, bill_id: billId,
      avisos: [], anexos: [{ descricao: corpo.descricaoAnexo, nome: corpo.nomeArquivo, ok: true }],
    });
    return { sequentialNumber, billId, message: `Nota fiscal ${corpo.cabecalho.numero} cadastrada com sucesso (sequencial ${sequentialNumber}).`, avisos: [], cadastroId: null };
  },
};
