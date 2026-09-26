import type { AppLogic } from '../AppLogic';
import {
  nfApi, NOMES_TIPO, SIGLAS_ANEXO, PAPEIS, MAX_BYTES_PDF, MAX_DESCRICAO_ANEXO, temItens,
  lerComoBase64, impressaoDigital, formatarTamanho,
  type TipoDocumento, type PedidoAberto, type PreviewNota, type ConfirmacaoCorpo, type NfCadastro, type ItemNotaPreview,
} from '../../lib/nf';
import { tomticketApi, type ChamadoPreparado } from '../../lib/tomticket';

// Notas Fiscais › Cadastros: histórico (app_nf_cadastros) + assistente de cadastro de nota de
// compra no Sienge (edge function app-nf), portado do projeto sienge-nf-automatica:
// envio do PDF → escolha do pedido → conferência → cadastrada. Tela: screens/NotasCadastrosPage.tsx.

const PERM = 'notas.cadastros';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const fmtMoeda = (v: number | null | undefined) => (v == null ? '—' : moeda.format(v));
const fmtNum = (v: number | null | undefined) => (v == null ? '—' : numero.format(v));
const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const paraNumero = (t: string) => Number.parseFloat(String(t).replace(',', '.'));

const STATUS_PEDIDO: Record<string, string> = { PENDING: 'Não atendido', PARTIALLY_DELIVERED: 'Parcialmente atendido' };

const CRITERIOS: Record<PreviewNota['criterioSelecao'], string | null> = {
  valor_total: 'O valor do documento bate com o saldo do pedido: todos os insumos vieram marcados.',
  similaridade: 'Insumos marcados pela semelhança com os itens da nota. Confira as quantidades.',
  proporcional: 'Documento sem itens: a quantidade foi calculada pelo valor do documento.',
  nenhum: null,
};

const SUGESTOES_ANEXO = ['NF', 'NFS', 'BLT', 'FAT'];

/** Sugere a sigla pelo nome do arquivo ("...-boleto.pdf" → BLT). */
function sugerirDescricao(nome: string): string {
  const n = nome.toLowerCase();
  if (/boleto|\bblt\b/.test(n)) return 'BLT';
  if (/fatura|\bfat\b/.test(n)) return 'FAT';
  if (/nfs|servi[cç]o/.test(n)) return 'NFS';
  if (/\bnf\b|nfe|danfe|nota/.test(n)) return 'NF';
  return '';
}

interface Linha { itemNumber: number; indiceNota: number | null; similaridade: number | null; selecionado: boolean; quantidade: string }
interface AnexoExtra { id: string; arquivo: File; descricao: string }
type StatusEnvio = 'pendente' | 'enviando' | 'anexado' | 'falhou' | 'sem_titulo';
interface EnvioAnexo extends AnexoExtra { status: StatusEnvio; erro?: string }

const ROTULOS_ENVIO: Record<StatusEnvio, string> = { pendente: 'Na fila', enviando: 'Enviando…', anexado: 'Anexado', falhou: 'Falhou', sem_titulo: 'Não enviado' };

/** Estado inicial do assistente (também usado para recomeçar). */
export const NF_INICIAL = {
  nfEtapa: 'lista', nfArquivo: null, nfBusy: '', nfErro: '', nfAnalise: null, nfPreview: null, nfPedidoId: null,
  nfTipo: null, nfCab: null, nfCentro: '', nfLinhas: [], nfDescPrincipal: null, nfAnexos: [], nfRecusados: [],
  nfSenha: null, nfResultado: null, nfEnvios: [], nfChamado: null,
};

/** Modal do chamado de conferência do título no TomTicket (null = fechado e ainda não criado). */
interface ChamadoState {
  aberto: boolean; carregando: boolean; enviando: boolean; erro: string;
  dados: ChamadoPreparado | null; categoriaId: string; mensagem: string;
  criado: boolean; protocolo: string | null;
}

export function notasCadastrosVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const podeVer = this.pode(PERM);
  const podeEditar = this.pode(PERM, true);
  const set = (patch: any) => this.setState(patch);
  const erroDe = (e: any) => e?.message || 'Não foi possível falar com o servidor.';

  // ---------- histórico ----------
  const lista: NfCadastro[] = s.nfLista || [];
  const q = (s.nfBusca || '').trim().toLowerCase();
  const situacao = s.nfSituacao || 'Todas';
  const filtrada = lista.filter(r => {
    if (situacao === 'Com pendência' && !(r.situacao !== 'cadastrada' || r.avisos.length || r.anexos.some(a => !a.ok))) return false;
    if (!q) return true;
    return [r.numero, r.fornecedor_nome, r.empresa_nome, r.pedido, r.obra_nome, String(r.sequencial), r.criado_por_email]
      .some(x => (x || '').toLowerCase().includes(q));
  });
  const historico = filtrada.map(r => {
    const pendente = r.situacao !== 'cadastrada' || r.avisos.length > 0 || r.anexos.some(a => !a.ok);
    const em = new Date(r.criado_em);
    return {
      id: r.id,
      dia: em.toLocaleDateString('pt-BR'),
      hora: em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      quem: (r.criado_por_email || '').split('@')[0] || '—',
      documento: `${SIGLAS_ANEXO[r.tipo_documento] || r.tipo_documento} ${r.numero}${r.serie ? ` · série ${r.serie}` : ''}`,
      tipo: NOMES_TIPO[r.tipo_documento] || r.tipo_documento,
      fornecedor: r.fornecedor_nome || '—',
      empresa: r.empresa_nome || '—',
      pedido: r.pedido,
      obra: r.obra_nome || '',
      valor: fmtMoeda(r.valor),
      vencimento: fmtData(r.vencimento),
      sequencial: String(r.sequencial),
      titulo: r.bill_id ? String(r.bill_id) : 'não gerado',
      anexos: r.anexos.length,
      situacao: r.situacao === 'itens_nao_vinculados' ? 'Insumos não vinculados' : pendente ? 'Com pendência' : 'Cadastrada',
      tom: r.situacao === 'itens_nao_vinculados' ? 'erro' : pendente ? 'aviso' : 'ok',
      detalhes: [...r.avisos, ...r.anexos.filter(a => !a.ok).map(a => `Anexo ${a.descricao} (${a.nome}) não foi enviado${a.erro ? `: ${a.erro}` : ''}.`)],
    };
  });

  // ---------- assistente ----------
  const etapa: string = s.nfEtapa || 'lista';
  const preview: PreviewNota | null = s.nfPreview;
  const tipo: TipoDocumento = s.nfTipo || preview?.tipoDocumento || 'NFE';
  const comItens = temItens(tipo);
  const linhas: Linha[] = s.nfLinhas || [];
  const cab = s.nfCab || {};
  const senha = s.nfSenha || { liberada: null, pedindo: false, digitada: '', erro: '' };
  const anexos: AnexoExtra[] = s.nfAnexos || [];
  const descricaoPrincipal: string = s.nfDescPrincipal ?? SIGLAS_ANEXO[tipo];
  const busy: string = s.nfBusy || '';

  const irPara = (patch: any) => set({ view: 'app', page: 'nfCadastros', module: 'Notas Fiscais', nfOpen: true, userMenuOpen: false, ...patch });
  const recomecar = (patch: any = {}) => set({ ...NF_INICIAL, ...patch });

  const escolherArquivo = (arquivo: File | null | undefined) => {
    if (!arquivo) return;
    if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) { set({ nfErro: `${arquivo.name}: envie um arquivo PDF.` }); return; }
    if (arquivo.size > MAX_BYTES_PDF) {
      set({ nfErro: `${arquivo.name}: ${formatarTamanho(arquivo.size)} passa do limite de ${formatarTamanho(MAX_BYTES_PDF)}. Comprima o PDF e tente de novo.` });
      return;
    }
    this._nfDigital = null;
    set({ nfArquivo: arquivo, nfErro: '' });
  };

  const analisar = async () => {
    const arquivo: File | null = s.nfArquivo;
    if (!arquivo || busy) return;
    if (!podeEditar) { this.toast('Seu perfil não tem permissão para cadastrar notas fiscais.'); return; }
    set({ nfBusy: 'analisar', nfErro: '' });
    try {
      const pdfBase64 = await lerComoBase64(arquivo);
      this._nfPdf = pdfBase64;
      const analise = await nfApi.analisar(pdfBase64);
      set({ nfAnalise: analise, nfEtapa: 'pedido', nfBusy: '' });
    } catch (e: any) {
      set({ nfBusy: '', nfErro: erroDe(e) });
    }
  };

  const escolherPedido = async (p: PedidoAberto) => {
    if (busy || !s.nfAnalise) return;
    set({ nfBusy: 'pedido:' + p.id, nfErro: '' });
    try {
      const pv = await nfApi.preview(s.nfAnalise.documento, String(p.id));
      set({
        nfPreview: pv, nfPedidoId: String(p.id), nfEtapa: 'conferencia', nfBusy: '',
        nfTipo: pv.tipoDocumento,
        nfCab: { numero: pv.cabecalho.numero, serie: pv.cabecalho.serie ?? '', dataEmissao: pv.cabecalho.dataEmissao ?? '', dataMovimento: pv.cabecalho.dataMovimento, vencimento: pv.cabecalho.vencimento, obs: '' },
        nfCentro: '', nfDescPrincipal: null, nfAnexos: [], nfRecusados: [], nfSenha: null,
        nfLinhas: pv.vinculos.map(v => ({ itemNumber: v.itemNumber, indiceNota: v.indiceNota, similaridade: v.similaridade, selecionado: v.selecionado, quantidade: String(v.quantidade) })),
      });
    } catch (e: any) {
      set({ nfBusy: '', nfErro: erroDe(e) });
    }
  };

  // ---------- conferência ----------
  const pedidoPorItem = new Map((preview?.itensPedido || []).map(i => [i.itemNumber, i]));
  const notaPorIndice = new Map((preview?.itensNota || []).map(i => [i.indice, i]));

  const problemas = new Map<number, string>();
  for (const l of linhas) {
    if (!l.selecionado) continue;
    const item = pedidoPorItem.get(l.itemNumber);
    const qtd = paraNumero(l.quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) problemas.set(l.itemNumber, 'Informe a quantidade');
    else if (item && qtd > item.quantidadeEmAberto + 1e-6) problemas.set(l.itemNumber, `Máximo ${fmtNum(item.quantidadeEmAberto)}`);
  }
  const valorSelecionado = linhas.reduce((t, l) => {
    const item = pedidoPorItem.get(l.itemNumber);
    const qtd = paraNumero(l.quantidade);
    return l.selecionado && item && Number.isFinite(qtd) ? t + qtd * item.precoUnitario : t;
  }, 0);
  const valorDocumento = preview?.cabecalho.valorTotal ?? 0;
  const diferenca = valorDocumento - valorSelecionado;
  const associados = new Set(linhas.map(l => l.indiceNota).filter((i): i is number => i !== null));
  const semVinculo = (preview?.itensNota || []).filter(i => !associados.has(i.indice));
  const selecionados = linhas.filter(l => l.selecionado);
  const centro = String(s.nfCentro || '').trim();

  const pendencias = [
    ...(preview && preview.bloqueios.length ? ['Resolva os bloqueios acima.'] : []),
    ...(!/^\d+$/.test(centro) ? ['Informe o centro de custo.'] : []),
    ...(!String(cab.numero || '').trim() ? ['Informe o número do documento.'] : []),
    ...(!cab.dataEmissao ? ['Informe a data de emissão.'] : []),
    ...(!cab.vencimento ? ['Informe o vencimento.'] : []),
    ...(selecionados.length === 0 ? ['Selecione ao menos um insumo do pedido.'] : []),
    ...(problemas.size ? ['Corrija as quantidades destacadas.'] : []),
    ...(!descricaoPrincipal.trim() || anexos.some(a => !a.descricao.trim()) ? ['Informe a descrição de todos os anexos.'] : []),
    ...(!podeEditar ? ['Seu perfil só pode consultar as notas cadastradas.'] : []),
  ];

  const patchCab = (p: any) => this.setState(st => ({ nfCab: { ...(st.nfCab || {}), ...p } }));
  const patchLinha = (itemNumber: number, p: Partial<Linha>) =>
    this.setState(st => ({ nfLinhas: (st.nfLinhas || []).map((l: Linha) => (l.itemNumber === itemNumber ? { ...l, ...p } : l)) }));
  const patchSenha = (p: any) => this.setState(st => ({ nfSenha: { ...(st.nfSenha || { liberada: null, pedindo: false, digitada: '', erro: '' }), ...p } }));

  const associarNota = (itemNumber: number, valor: string) => {
    const indice = valor === '' ? null : Number(valor);
    const itemNota = indice === null ? undefined : notaPorIndice.get(indice);
    const itemPedido = pedidoPorItem.get(itemNumber);
    this.setState(st => ({
      nfLinhas: (st.nfLinhas || []).map((l: Linha) => {
        if (l.itemNumber === itemNumber) {
          const m: Partial<Linha> = { indiceNota: indice, similaridade: null };
          if (itemNota?.quantidade && itemPedido) {
            m.quantidade = String(Math.min(itemNota.quantidade, itemPedido.quantidadeEmAberto));
            m.selecionado = itemPedido.quantidadeEmAberto > 0;
          }
          return { ...l, ...m };
        }
        // Um item da nota fica associado a um único insumo do pedido.
        return indice !== null && l.indiceNota === indice ? { ...l, indiceNota: null, similaridade: null } : l;
      }),
    }));
  };

  const marcarTodos = (marcar: boolean) => this.setState(st => ({
    nfLinhas: (st.nfLinhas || []).map((l: Linha) => ({ ...l, selecionado: marcar && (pedidoPorItem.get(l.itemNumber)?.quantidadeEmAberto ?? 0) > 0 })),
  }));

  const liberarVencimento = async () => {
    if (!senha.digitada || busy) return;
    set({ nfBusy: 'senha' });
    try {
      await nfApi.liberarVencimento(senha.digitada);
      this.setState({ nfBusy: '' });
      patchSenha({ liberada: senha.digitada, pedindo: false, erro: '' });
    } catch (e: any) {
      this.setState({ nfBusy: '' });
      patchSenha({ erro: e?.status === 403 ? 'Senha incorreta.' : 'Não foi possível verificar a senha.' });
    }
  };

  const adicionarAnexos = async (lista: FileList | null) => {
    if (!lista || !lista.length || !s.nfArquivo) return;
    const arquivos = Array.from(lista);
    set({ nfBusy: 'anexos' });
    try {
      this._nfDigital ??= impressaoDigital(s.nfArquivo);
      const principal = await this._nfDigital;
      const vistos = new Set(anexos.map(a => a.id));
      const novos: AnexoExtra[] = [];
      const recusados: string[] = [];
      for (const arquivo of arquivos) {
        if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) { recusados.push(`${arquivo.name}: envie apenas arquivos PDF.`); continue; }
        if (arquivo.size > MAX_BYTES_PDF) {
          recusados.push(`${arquivo.name}: ${formatarTamanho(arquivo.size)} passa do limite de ${formatarTamanho(MAX_BYTES_PDF)}. Comprima o PDF e tente de novo.`);
          continue;
        }
        const digital = await impressaoDigital(arquivo);
        if (digital === principal) { recusados.push(`${arquivo.name}: é o mesmo PDF enviado para cadastro — ele já vai anexado automaticamente.`); continue; }
        if (vistos.has(digital)) { recusados.push(`${arquivo.name}: este arquivo já está na lista.`); continue; }
        vistos.add(digital);
        novos.push({ id: digital, arquivo, descricao: sugerirDescricao(arquivo.name) });
      }
      this.setState(st => ({ nfBusy: '', nfRecusados: recusados, nfAnexos: (st.nfAnexos || []).concat(novos) }));
    } catch {
      set({ nfBusy: '', nfRecusados: ['Não foi possível ler os arquivos selecionados.'] });
    }
  };

  const marcarEnvio = (id: string, status: StatusEnvio, erro?: string) =>
    this.setState(st => ({ nfEnvios: (st.nfEnvios || []).map((e: EnvioAnexo) => (e.id === id ? { ...e, status, erro } : e)) }));

  const anexar = async (billId: number, a: AnexoExtra, cadastroId?: string | null) => {
    marcarEnvio(a.id, 'enviando');
    try {
      await nfApi.anexar(billId, a.arquivo, a.descricao.trim(), cadastroId);
      marcarEnvio(a.id, 'anexado');
    } catch (e: any) {
      marcarEnvio(a.id, 'falhou', erroDe(e));
    }
  };

  const cadastrar = async () => {
    if (!preview || pendencias.length || busy) return;
    set({ nfBusy: 'cadastrar', nfErro: '' });
    const corpo: ConfirmacaoCorpo = {
      purchaseOrderId: s.nfPedidoId,
      tipoDocumento: tipo,
      pdfBase64: this._nfPdf,
      nomeArquivo: s.nfArquivo?.name || 'nota-fiscal.pdf',
      descricaoAnexo: descricaoPrincipal.trim(),
      centroCustoId: Number(centro),
      cabecalho: {
        numero: String(cab.numero).trim(),
        serie: String(cab.serie || '').trim() || null,
        dataEmissao: cab.dataEmissao,
        dataMovimento: cab.dataMovimento,
        observacaoComplementar: cab.obs || '',
      },
      itens: selecionados.map(l => ({ itemNumber: l.itemNumber, quantidade: paraNumero(l.quantidade) })),
      ...(senha.liberada !== null ? { vencimentoManual: { data: cab.vencimento, senha: senha.liberada } } : {}),
      fornecedorNome: preview.fornecedor?.nome ?? preview.fornecedorNota.nome,
      empresaNome: preview.empresa?.nome ?? preview.destinatarioNota.nome,
      valor: valorDocumento,
    };
    try {
      const resultado = await nfApi.cadastrar(corpo);
      const extras = anexos;
      // Anexos extras sobem um por vez, depois que o Sienge gerou o título.
      set({
        nfBusy: '', nfEtapa: 'concluido', nfResultado: resultado,
        nfEnvios: extras.map(a => ({ ...a, status: resultado.billId ? 'pendente' : 'sem_titulo' })),
      });
      this.loadNfHistorico();
      if (resultado.billId) {
        for (const a of extras) await anexar(resultado.billId, a, resultado.cadastroId);
        if (extras.length) this.loadNfHistorico();
      }
    } catch (e: any) {
      const rede = !e?.status;
      set({
        nfBusy: '',
        nfErro: rede ? 'Não foi possível falar com o servidor. Verifique no Sienge se a nota foi criada antes de tentar de novo.' : erroDe(e),
      });
      if (e?.status === 502) this.loadNfHistorico();
    }
  };

  // ---------- chamado de conferência no TomTicket ----------
  const chamado: ChamadoState | null = s.nfChamado;
  const setChamado = (patch: Partial<ChamadoState>) => this.setState(st => ({ nfChamado: { ...st.nfChamado, ...patch } }));
  const abrirChamado = async (billId: number) => {
    if (chamado?.carregando) return;
    set({ nfChamado: { aberto: true, carregando: true, enviando: false, erro: '', dados: null, categoriaId: '', mensagem: '', criado: false, protocolo: null } });
    try {
      const dados = await tomticketApi.preparar(billId);
      setChamado({ carregando: false, dados, categoriaId: dados.categoriaPadraoId || '', mensagem: dados.mensagem });
    } catch (e: any) {
      setChamado({ carregando: false, erro: erroDe(e) });
    }
  };
  const criarChamado = async (billId: number) => {
    const c: ChamadoState | null = this.state.nfChamado;
    if (!c?.dados || c.enviando) return;
    if (!c.categoriaId) { setChamado({ erro: 'Escolha a categoria do chamado.' }); return; }
    if (!c.mensagem.trim()) { setChamado({ erro: 'Escreva a mensagem do chamado.' }); return; }
    setChamado({ enviando: true, erro: '' });
    try {
      const r = await tomticketApi.criar(billId, c.categoriaId, c.mensagem.trim());
      setChamado({ enviando: false, aberto: false, criado: true, protocolo: r.protocolo });
      this.toast(r.protocolo ? `Chamado ${r.protocolo} aberto no TomTicket.` : 'Chamado aberto no TomTicket.');
    } catch (e: any) {
      setChamado({ enviando: false, erro: erroDe(e) });
    }
  };

  const papeis = PAPEIS[tipo];
  const resultado = s.nfResultado;
  const envios: EnvioAnexo[] = s.nfEnvios || [];
  const dbCentro = /^\d+$/.test(centro) ? (s.dbCentros || []).find((c: any) => String(c.id) === centro) : null;
  const detalheNota = (item: ItemNotaPreview, completo = false) => [
    item.codigo && `Cód. ${item.codigo}`,
    item.ncm && `NCM ${item.ncm}`,
    completo && item.descricao,
    completo && item.quantidade != null && `${fmtNum(item.quantidade)} ${item.unidade ?? ''}`.trim(),
    completo && item.valorTotal != null && fmtMoeda(item.valorTotal),
  ].filter(Boolean).join(' · ');

  const activeItem = ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997';
  const passos = ['Envio', 'Pedido', 'Conferência', 'Cadastrada'];
  const idxEtapa = ['envio', 'pedido', 'conferencia', 'concluido'].indexOf(etapa);

  return {
    // ---- sidebar / navegação ----
    nfGroupStyle: podeVer ? '' : 'display:none',
    toggleNf: () => this.setState(st => ({ nfOpen: !st.nfOpen })),
    nfChevron: (!s.collapsed && s.nfOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    nfContentStyle: `display:grid;grid-template-rows:${(!s.collapsed && s.nfOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    nfCadastrosItemStyle: s.page === 'nfCadastros' ? subItemStyle + activeItem : subItemStyle,
    goNfCadastros: (e?: any) => { if (e && e.preventDefault) e.preventDefault(); irPara({}); },
    nfTileVisible: podeVer,
    isNfCadastros: s.page === 'nfCadastros',

    nf: {
      etapa,
      podeEditar,
      passos: passos.map((label, i) => ({ label, numero: i + 1, estado: i < idxEtapa ? 'feito' : i === idxEtapa ? 'atual' : 'futuro' })),
      busy,
      erro: s.nfErro || '',
      limparErro: () => set({ nfErro: '' }),
      novo: () => {
        if (!podeEditar) { this.toast('Seu perfil não tem permissão para cadastrar notas fiscais.'); return; }
        recomecar({ nfEtapa: 'envio' });
      },
      cancelar: () => {
        if (busy === 'cadastrar') return;
        if (etapa === 'conferencia' && !window.confirm('Sair sem cadastrar? Os dados conferidos serão perdidos.')) return;
        recomecar();
      },

      // histórico
      carregando: s.nfLista == null,
      historico,
      totalLabel: `${lista.length} ${lista.length === 1 ? 'nota cadastrada' : 'notas cadastradas'} pelo app`,
      rangeLabel: lista.length ? `Mostrando ${filtrada.length} de ${lista.length}` : 'Nenhuma nota cadastrada ainda',
      busca: s.nfBusca || '',
      onBusca: (e: any) => set({ nfBusca: e.target.value }),
      situacaoTabs: ['Todas', 'Com pendência'].map(t => ({ label: t, ativo: situacao === t, onClick: () => set({ nfSituacao: t }) })),
      filtrado: !!q || situacao !== 'Todas',
      limparFiltros: () => set({ nfBusca: '', nfSituacao: 'Todas' }),
      recarregar: () => this.loadNfHistorico(true),
      aberto: s.nfAbertoId || null,
      alternar: (id: string) => this.setState(st => ({ nfAbertoId: st.nfAbertoId === id ? null : id })),

      // 1. envio
      arquivo: s.nfArquivo ? { nome: s.nfArquivo.name, tamanho: formatarTamanho(s.nfArquivo.size) } : null,
      limiteLabel: formatarTamanho(MAX_BYTES_PDF),
      onArquivo: (e: any) => { const f = e.target.files?.[0]; e.target.value = ''; escolherArquivo(f); },
      onSoltar: (e: any) => { e.preventDefault(); set({ nfArrastando: false }); escolherArquivo(e.dataTransfer?.files?.[0]); },
      arrastando: !!s.nfArrastando,
      onArrastar: (e: any) => { e.preventDefault(); if (!s.nfArrastando) set({ nfArrastando: true }); },
      onSair: () => set({ nfArrastando: false }),
      removerArquivo: () => { this._nfDigital = null; set({ nfArquivo: null, nfErro: '' }); },
      analisar,

      // 2. pedido
      analise: s.nfAnalise ? (() => {
        const a = s.nfAnalise;
        return {
          tipo: NOMES_TIPO[a.documento.tipoDocumento as TipoDocumento],
          numero: a.documento.numero,
          valor: fmtMoeda(a.documento.valorTotal),
          emissao: fmtData(a.documento.dataEmissao),
          fornecedor: a.fornecedor ? `${a.fornecedor.id} — ${a.fornecedor.nome}` : (a.documento.fornecedorNome ?? '—'),
          fornecedorCnpj: a.fornecedor?.cnpj || '',
          empresa: a.empresa ? `${a.empresa.id} — ${a.empresa.nome}` : (a.documento.destinatarioNome ?? '—'),
          empresaCnpj: a.empresa?.cnpj || '',
          bloqueios: a.bloqueios as string[],
          outraEmpresa: a.pedidosOutraEmpresa as number,
          pedidos: (a.pedidos as PedidoAberto[]).map(p => ({
            id: p.id,
            numero: p.numero,
            data: fmtData(p.data),
            obra: p.obraId ? `${p.obraId} — ${p.obraNome ?? ''}` : '—',
            status: STATUS_PEDIDO[p.status] || p.status,
            parcial: p.status === 'PARTIALLY_DELIVERED',
            valor: fmtMoeda(p.valorTotal),
            carregando: busy === 'pedido:' + p.id,
            escolher: () => escolherPedido(p),
          })),
        };
      })() : null,
      voltarEnvio: () => set({ nfEtapa: 'envio', nfAnalise: null, nfErro: '' }),

      // 3. conferência
      conf: preview ? {
        bloqueios: preview.bloqueios,
        avisos: preview.avisos,
        tipo,
        tipos: (Object.keys(NOMES_TIPO) as TipoDocumento[]).map(t => ({ value: t, label: NOMES_TIPO[t] })),
        onTipo: (e: any) => set({ nfTipo: e.target.value }),
        tipoDetalhe: `Documento no Sienge: ${preview.documentIds[tipo]}${tipo !== preview.tipoDocumento ? ` · identificado como ${NOMES_TIPO[preview.tipoDocumento]}` : ''}`,
        numero: cab.numero ?? '', onNumero: (e: any) => patchCab({ numero: e.target.value }),
        serie: cab.serie ?? '', onSerie: (e: any) => patchCab({ serie: e.target.value }),
        dataEmissao: cab.dataEmissao ?? '', onDataEmissao: (e: any) => patchCab({ dataEmissao: e.target.value }),
        dataMovimento: cab.dataMovimento ?? '', onDataMovimento: (e: any) => patchCab({ dataMovimento: e.target.value }),
        fornecedorRotulo: `Fornecedor (CNPJ do ${papeis.vendedor})`,
        fornecedor: preview.fornecedor ? `${preview.fornecedor.id} — ${preview.fornecedor.nome}` : 'Não encontrado',
        fornecedorCnpj: preview.fornecedorNota.cnpj || '',
        empresaRotulo: `Empresa (CNPJ do ${papeis.comprador})`,
        empresa: preview.empresa ? `${preview.empresa.id} — ${preview.empresa.nome}` : 'Não encontrada',
        empresaCnpj: preview.destinatarioNota.cnpj || '',
        pedido: preview.pedido.numero,
        pedidoObra: preview.pedido.obraId ? `Obra ${preview.pedido.obraId} — ${preview.pedido.obraNome ?? ''}` : '',
        valor: fmtMoeda(valorDocumento),
        centro: s.nfCentro || '',
        onCentro: (e: any) => set({ nfCentro: e.target.value.replace(/\D/g, '') }),
        centroNome: dbCentro ? dbCentro.nome : '',
        observacaoAutomatica: preview.cabecalho.observacaoAutomatica,
        obs: cab.obs ?? '', onObs: (e: any) => patchCab({ obs: e.target.value }),

        // vencimento (senha)
        vencimento: cab.vencimento ?? '',
        vencimentoMin: preview.cabecalho.dataMovimento,
        vencimentoEditavel: preview.vencimentoEditavel,
        vencimentoLiberado: senha.liberada !== null,
        onVencimento: (e: any) => patchCab({ vencimento: e.target.value }),
        pedirSenha: () => { if (senha.liberada === null && preview.vencimentoEditavel) patchSenha({ pedindo: true, digitada: '', erro: '' }); },
        pedindoSenha: !!senha.pedindo,
        senhaDigitada: senha.digitada,
        onSenha: (e: any) => patchSenha({ digitada: e.target.value }),
        onSenhaKey: (e: any) => { if (e.key === 'Enter') liberarVencimento(); if (e.key === 'Escape') patchSenha({ pedindo: false }); },
        liberar: liberarVencimento,
        cancelarSenha: () => patchSenha({ pedindo: false }),
        senhaErro: senha.erro,
        verificandoSenha: busy === 'senha',
        restaurarVencimento: () => { patchSenha({ liberada: null }); patchCab({ vencimento: preview.cabecalho.vencimento }); },
        vencimentoDocumento: preview.cabecalho.vencimentoDocumento ? fmtData(preview.cabecalho.vencimentoDocumento) : '',

        // insumos
        comItens,
        criterio: CRITERIOS[preview.criterioSelecao],
        semItensDica: comItens ? '' : `${NOMES_TIPO[tipo]} não traz itens: marque os insumos do pedido que ele atende.`,
        marcarTodos: () => marcarTodos(true),
        desmarcarTodos: () => marcarTodos(false),
        itensNota: preview.itensNota.map(n => ({ value: String(n.indice), label: `${n.codigo ? `${n.codigo} · ` : ''}${n.descricao}` })),
        linhas: linhas.map(l => {
          const item = pedidoPorItem.get(l.itemNumber)!;
          const nota = l.indiceNota === null ? undefined : notaPorIndice.get(l.indiceNota);
          const qtd = paraNumero(l.quantidade);
          const sim = l.similaridade;
          return {
            itemNumber: l.itemNumber,
            selecionado: l.selecionado,
            semSaldo: item.quantidadeEmAberto <= 0,
            onSelecionar: (e: any) => patchLinha(l.itemNumber, { selecionado: e.target.checked }),
            indiceNota: l.indiceNota === null ? '' : String(l.indiceNota),
            onNota: (e: any) => associarNota(l.itemNumber, e.target.value),
            notaDetalhe: nota ? detalheNota(nota) : '',
            notaQtd: nota ? `${fmtNum(nota.quantidade)} ${nota.unidade ?? ''}`.trim() : '—',
            notaValor: nota ? fmtMoeda(nota.valorTotal) : '',
            similaridade: l.indiceNota !== null && sim === null ? 'manual' : sim === null ? '—' : `${Math.round(sim * 100)}%`,
            nivel: l.indiceNota !== null && sim === null ? 'manual' : sim === null ? 'vazio' : sim >= 0.7 ? 'alta' : sim >= 0.5 ? 'media' : 'baixa',
            insumo: `${item.codigoInsumo ? `${item.codigoInsumo} — ` : ''}${item.descricao}`,
            insumoDetalhe: `Item ${item.itemNumber} · ${fmtMoeda(item.precoUnitario)}/${item.unidade ?? 'un'}${item.quantidadeEmAberto <= 0 ? ' · sem saldo' : ''}`,
            pendente: `${fmtNum(item.quantidadeEmAberto)} ${item.unidade ?? ''}`.trim(),
            quantidade: l.quantidade,
            max: item.quantidadeEmAberto,
            onQuantidade: (e: any) => patchLinha(l.itemNumber, { quantidade: e.target.value }),
            problema: problemas.get(l.itemNumber) || '',
            subtotal: l.selecionado && Number.isFinite(qtd) ? fmtMoeda(qtd * item.precoUnitario) : '—',
          };
        }),
        semVinculo: comItens ? semVinculo.map(i => ({ indice: i.indice, texto: detalheNota(i, true) })) : [],
        totalDocumento: fmtMoeda(valorDocumento),
        totalSelecionado: fmtMoeda(valorSelecionado),
        diferenca: fmtMoeda(diferenca),
        diferente: Math.abs(diferenca) > 0.01,

        // anexos
        nomePrincipal: s.nfArquivo?.name || '',
        descricaoPrincipal,
        onDescricaoPrincipal: (e: any) => set({ nfDescPrincipal: e.target.value }),
        sugestoesAnexo: SUGESTOES_ANEXO,
        maxDescricao: MAX_DESCRICAO_ANEXO,
        anexos: anexos.map(a => ({
          id: a.id,
          nome: a.arquivo.name,
          tamanho: formatarTamanho(a.arquivo.size),
          descricao: a.descricao,
          onDescricao: (e: any) => this.setState(st => ({ nfAnexos: (st.nfAnexos || []).map((x: AnexoExtra) => (x.id === a.id ? { ...x, descricao: e.target.value } : x)) })),
          remover: () => this.setState(st => ({ nfAnexos: (st.nfAnexos || []).filter((x: AnexoExtra) => x.id !== a.id) })),
        })),
        recusados: s.nfRecusados || [],
        lendoAnexos: busy === 'anexos',
        onAnexos: (e: any) => { const l = e.target.files; adicionarAnexos(l).finally(() => { e.target.value = ''; }); },

        // rodapé
        pendencias,
        cadastrando: busy === 'cadastrar',
        cadastrar,
        voltar: () => { if (busy !== 'cadastrar') set({ nfEtapa: 'pedido', nfPreview: null, nfErro: '' }); },
        resumo: `Emissão ${fmtData(cab.dataEmissao || null)} · vencimento ${fmtData(cab.vencimento)} · ${selecionados.length} insumo${selecionados.length === 1 ? '' : 's'} selecionado${selecionados.length === 1 ? '' : 's'} · ${anexos.length + 1} anexo${anexos.length ? 's' : ''}`,
      } : null,

      // 4. concluído
      resultado: resultado ? {
        mensagem: resultado.message,
        sequencial: String(resultado.sequentialNumber),
        titulo: resultado.billId ? String(resultado.billId) : 'ainda não gerado',
        avisos: resultado.avisos as string[],
        semTitulo: envios.some(e => e.status === 'sem_titulo'),
        envios: envios.map(e => ({
          id: e.id,
          descricao: e.descricao,
          nome: e.arquivo.name,
          erro: e.erro || '',
          status: e.status,
          rotulo: ROTULOS_ENVIO[e.status],
          reenviar: () => { if (resultado.billId) anexar(resultado.billId, e, resultado.cadastroId).then(() => this.loadNfHistorico()); },
        })),
        enviando: envios.some(e => e.status === 'pendente' || e.status === 'enviando'),
        chamado: resultado.billId ? {
          aberto: !!chamado?.aberto,
          carregando: !!chamado?.carregando,
          enviando: !!chamado?.enviando,
          erro: chamado?.erro || '',
          criado: !!chamado?.criado,
          protocolo: chamado?.protocolo || '',
          email: chamado?.dados?.email || '',
          clienteEncontrado: chamado?.dados ? chamado.dados.clienteEncontrado : null,
          departamento: chamado?.dados?.departamento.nome || '',
          assunto: chamado?.dados?.assunto || '',
          categorias: chamado?.dados?.categorias || [],
          categoriaId: chamado?.categoriaId || '',
          mensagem: chamado?.mensagem || '',
          pronto: !!chamado?.dados,
          abrir: () => abrirChamado(resultado.billId),
          fechar: () => { if (!chamado?.enviando) setChamado({ aberto: false, erro: '' }); },
          onCategoria: (e: any) => setChamado({ categoriaId: e.target.value, erro: '' }),
          onMensagem: (e: any) => setChamado({ mensagem: e.target.value, erro: '' }),
          criar: () => criarChamado(resultado.billId),
        } : null,
      } : null,
      outra: () => recomecar({ nfEtapa: 'envio' }),
      verHistorico: () => recomecar(),
    },
  };
}
