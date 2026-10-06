import type { AppLogic } from '../AppLogic';
import { NOMES_TIPO, SIGLAS_ANEXO, PAPEIS, MAX_BYTES_PDF, MAX_DESCRICAO_ANEXO, lerComoBase64, impressaoDigital, formatarTamanho, type TipoDocumento } from '../../lib/nf';
import {
  titulosApi, MAX_OBSERVACAO_TITULO, MAX_PARCELAS, MAX_APROPRIACOES,
  type AnaliseTitulo, type TituloCorpo, type NfTitulo, type OrcamentoObra,
} from '../../lib/nfTitulos';

// Notas Fiscais › Título a Pagar: histórico (app_nf_titulos) + assistente de cadastro do título
// do contas a pagar no Sienge (edge function app-nf, ações titulo_*), sem pedido de compra:
// envio do PDF → conferência → cadastrado. Tela: screens/NotasTitulosPage.tsx.

const PERM = 'notas.titulos';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const fmtMoeda = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : moeda.format(v));
const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
/** Aceita "1.234,56", "1234,56" e "1234.56". */
const paraNumero = (t: string) => {
  const texto = String(t ?? '').trim();
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  return normalizado ? Number(normalizado) : NaN;
};
const doisDecimais = (v: number) => Math.round(v * 100) / 100;

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

/** Opções do seletor: documentos do Sienge (código — nome); sem a lista, os padrões de cada tipo. */
function opcoesDocumento(analise: AnaliseTitulo) {
  const padrao = (Object.keys(NOMES_TIPO) as TipoDocumento[]).map(t => ({ id: analise.documentIds[t], nome: NOMES_TIPO[t] }));
  const lista = analise.documentos?.length ? analise.documentos.slice() : padrao;
  for (const p of padrao) if (!lista.some(d => d.id === p.id)) lista.push(p);
  return lista.sort((a, b) => a.id.localeCompare(b.id)).map(d => ({ value: d.id, label: `${d.id} — ${d.nome}` }));
}

interface LinhaApropriacao { id: string; centro: string; plano: string; percentual: string }
interface LinhaObra { id: string; obra: string; unidade: string; item: string; percentual: string }
/** Orçamento carregado do Sienge: "o:<obra>" (unidades construtivas) e "u:<obra>|<unidade>" (itens). */
interface CargaOrcamento { carregando: boolean; erro: string; dados: OrcamentoObra | null }
interface AnexoExtra { id: string; arquivo: File; descricao: string }
type StatusEnvio = 'pendente' | 'enviando' | 'anexado' | 'falhou' | 'sem_titulo';
interface EnvioAnexo extends AnexoExtra { status: StatusEnvio; erro?: string }
interface EmpresaModalState { codigo: string; erro: string; enviando: boolean }

const ROTULOS_ENVIO: Record<StatusEnvio, string> = { pendente: 'Na fila', enviando: 'Enviando…', anexado: 'Anexado', falhou: 'Falhou', sem_titulo: 'Não enviado' };

let seqLinha = 0;
const novaLinha = (percentual = ''): LinhaApropriacao => ({ id: `ap${++seqLinha}`, centro: '', plano: '', percentual });
const novaLinhaObra = (percentual = ''): LinhaObra => ({ id: `ob${++seqLinha}`, obra: '', unidade: '', item: '', percentual });
/** Linha sem obra, unidade nem item: não conta (a apropriação de obra é opcional). */
const linhaObraVazia = (l: LinhaObra) => !l.obra.trim() && !l.unidade && !l.item.trim();

/** Estado inicial do assistente (também usado para recomeçar). */
export const NT_INICIAL = {
  ntEtapa: 'lista', ntArquivo: null, ntBusy: '', ntErro: '', ntAnalise: null, ntEmpresaManual: null, ntEmpresaModal: null,
  ntTipo: null, ntDocumento: null, ntCab: null, ntAprop: [], ntApropObra: [], ntOrc: {}, ntDescPrincipal: null, ntAnexos: [], ntRecusados: [],
  ntSenha: null, ntResultado: null, ntEnvios: [],
};

export function notasTitulosVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const podeVer = this.pode(PERM);
  const podeEditar = this.pode(PERM, true);
  const set = (patch: any) => this.setState(patch);
  const erroDe = (e: any) => e?.message || 'Não foi possível falar com o servidor.';
  const semPermissao = 'Seu perfil não tem permissão para cadastrar títulos a pagar.';

  // ---------- histórico ----------
  const lista: NfTitulo[] = s.ntLista || [];
  const q = (s.ntBusca || '').trim().toLowerCase();
  const situacao = s.ntSituacao || 'Todos';
  const pendenteDe = (r: NfTitulo) => !r.bill_id || r.avisos.length > 0 || r.anexos.some(a => !a.ok);
  const filtrada = lista.filter(r => {
    if (situacao === 'Com pendência' && !pendenteDe(r)) return false;
    if (!q) return true;
    return [r.numero, r.fornecedor_nome, r.empresa_nome, r.bill_id ? String(r.bill_id) : '', r.criado_por_email, r.documento_sienge]
      .some(x => (x || '').toLowerCase().includes(q));
  });
  const historico = filtrada.map(r => {
    const pendente = pendenteDe(r);
    const em = new Date(r.criado_em);
    return {
      id: r.id,
      dia: em.toLocaleDateString('pt-BR'),
      hora: em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      quem: (r.criado_por_email || '').split('@')[0] || '—',
      documento: `${r.documento_sienge || SIGLAS_ANEXO[r.tipo_documento] || r.tipo_documento} ${r.numero}`,
      tipo: NOMES_TIPO[r.tipo_documento] || r.tipo_documento,
      fornecedor: r.fornecedor_nome || '—',
      empresa: r.empresa_nome || '—',
      valor: fmtMoeda(r.valor),
      parcelas: `${r.parcelas}x${r.desconto ? ` · desc. ${fmtMoeda(r.desconto)}` : ''}`,
      vencimento: fmtData(r.vencimento),
      competencia: fmtData(r.data_competencia),
      titulo: r.bill_id ? String(r.bill_id) : 'não identificado',
      anexos: r.anexos.length,
      apropriacoes: r.apropriacoes.map(a => `CC ${a.costCenterId} · plano ${a.paymentCategoriesId} · ${pct.format(a.percentage)}%`),
      apropriacoesObra: (r.apropriacoes_obra || []).map(a => `Obra ${a.buildingId} · unidade ${a.buildingUnitId} · item ${a.costEstimationSheetId} · ${pct.format(a.percentage)}%`),
      situacao: pendente ? 'Com pendência' : 'Cadastrado',
      tom: pendente ? 'aviso' : 'ok',
      detalhes: [...r.avisos, ...r.anexos.filter(a => !a.ok).map(a => `Anexo ${a.descricao} (${a.nome}) não foi enviado${a.erro ? `: ${a.erro}` : ''}.`)],
    };
  });

  // ---------- assistente ----------
  const etapa: string = s.ntEtapa || 'lista';
  const analise: AnaliseTitulo | null = s.ntAnalise;
  const tipo: TipoDocumento = s.ntTipo || analise?.documento.tipoDocumento || 'NFE';
  const documentoPadrao = analise ? analise.documentIds[analise.documento.tipoDocumento] : '';
  const documento: string = s.ntDocumento || documentoPadrao;
  const cab = s.ntCab || {};
  const aprop: LinhaApropriacao[] = s.ntAprop || [];
  const apropObra: LinhaObra[] = s.ntApropObra || [];
  const orc: Record<string, CargaOrcamento> = s.ntOrc || {};
  const senha = s.ntSenha || { liberada: null, pedindo: false, digitada: '', erro: '' };
  const anexos: AnexoExtra[] = s.ntAnexos || [];
  const descricaoPrincipal: string = s.ntDescPrincipal ?? SIGLAS_ANEXO[tipo];
  const busy: string = s.ntBusy || '';

  const irPara = (patch: any) => set({ view: 'app', page: 'nfTitulos', module: 'Notas Fiscais', nfOpen: true, userMenuOpen: false, ...patch });
  const recomecar = (patch: any = {}) => set({ ...NT_INICIAL, ...patch });

  const escolherArquivo = (arquivo: File | null | undefined) => {
    if (!arquivo) return;
    if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) { set({ ntErro: `${arquivo.name}: envie um arquivo PDF.` }); return; }
    if (arquivo.size > MAX_BYTES_PDF) {
      set({ ntErro: `${arquivo.name}: ${formatarTamanho(arquivo.size)} passa do limite de ${formatarTamanho(MAX_BYTES_PDF)}. Comprima o PDF e tente de novo.` });
      return;
    }
    this._ntDigital = null;
    set({ ntArquivo: arquivo, ntErro: '' });
  };

  /** Preenche a conferência com o que veio da análise (também ao trocar a empresa). */
  const aplicarAnalise = (a: AnaliseTitulo, patch: any = {}) => set({
    ntAnalise: a, ntEtapa: 'conferencia', ntBusy: '', ntErro: '',
    ntTipo: a.documento.tipoDocumento, ntDocumento: a.documentIds[a.documento.tipoDocumento],
    ntCab: {
      numero: a.cabecalho.numero, dataEmissao: a.cabecalho.dataEmissao, dataCompetencia: a.cabecalho.dataCompetencia,
      dataBase: a.cabecalho.dataBase, vencimento: a.cabecalho.vencimento, valor: String(a.cabecalho.valorTotal).replace('.', ','),
      desconto: '', parcelas: '1', obs: '',
    },
    ntAprop: [novaLinha('100')], ntApropObra: [novaLinhaObra('100')], ntDescPrincipal: null, ntAnexos: [], ntRecusados: [], ntSenha: null,
    ...patch,
  });

  const analisar = async () => {
    const arquivo: File | null = s.ntArquivo;
    if (!arquivo || busy) return;
    if (!podeEditar) { this.toast(semPermissao); return; }
    set({ ntBusy: 'analisar', ntErro: '' });
    try {
      const pdfBase64 = await lerComoBase64(arquivo);
      this._ntPdf = pdfBase64;
      aplicarAnalise(await titulosApi.analisar(pdfBase64), { ntEmpresaManual: null, ntEmpresaModal: null });
    } catch (e: any) {
      set({ ntBusy: '', ntErro: erroDe(e) });
    }
  };

  // ---------- empresa informada manualmente ----------
  const empresaModal: EmpresaModalState | null = s.ntEmpresaModal;
  const patchEmpresaModal = (p: Partial<EmpresaModalState>) =>
    this.setState(st => ({ ntEmpresaModal: st.ntEmpresaModal ? { ...st.ntEmpresaModal, ...p } : null }));
  const confirmarEmpresa = async () => {
    if (!empresaModal || empresaModal.enviando || !analise) return;
    const codigo = Number(empresaModal.codigo);
    if (!Number.isInteger(codigo) || codigo <= 0) { patchEmpresaModal({ erro: 'Informe o código da empresa no Sienge.' }); return; }
    patchEmpresaModal({ enviando: true, erro: '' });
    try {
      const nova = await titulosApi.empresa(analise.documento, codigo);
      // Mantém o que o usuário já preencheu; só atualiza empresa, bloqueios e avisos.
      set({ ntAnalise: nova, ntEmpresaManual: codigo, ntEmpresaModal: null, ntErro: '' });
    } catch (e: any) {
      patchEmpresaModal({ enviando: false, erro: erroDe(e) });
    }
  };

  // ---------- conferência ----------
  const patchCab = (p: any) => this.setState(st => ({ ntCab: { ...(st.ntCab || {}), ...p } }));
  const patchLinha = (id: string, p: Partial<LinhaApropriacao>) =>
    this.setState(st => ({ ntAprop: (st.ntAprop || []).map((l: LinhaApropriacao) => (l.id === id ? { ...l, ...p } : l)) }));
  const patchSenha = (p: any) => this.setState(st => ({ ntSenha: { ...(st.ntSenha || { liberada: null, pedindo: false, digitada: '', erro: '' }), ...p } }));

  const valor = doisDecimais(paraNumero(cab.valor));
  const descontoTexto = String(cab.desconto ?? '').trim();
  const desconto = descontoTexto ? doisDecimais(paraNumero(descontoTexto)) : 0;
  const parcelas = Number(cab.parcelas);
  const centros = (s.dbCentros || []) as Array<{ id: number; nome: string; ativo?: boolean }>;
  const planos = analise?.planos || [];
  const planoPorId = new Map(planos.map(p => [p.id, p.nome]));

  const problemasLinha = new Map<string, string>();
  const vistos = new Set<string>();
  for (const l of aprop) {
    const p = paraNumero(l.percentual);
    if (!/^\d+$/.test(l.centro.trim())) problemasLinha.set(l.id, 'Informe o centro de custo');
    else if (!/^\d+$/.test(l.plano.trim())) problemasLinha.set(l.id, 'Informe o plano financeiro');
    else if (!Number.isFinite(p) || p <= 0 || p > 100) problemasLinha.set(l.id, 'Percentual entre 0 e 100');
    else {
      const chave = `${l.centro.trim()}|${l.plano.trim()}`;
      if (vistos.has(chave)) problemasLinha.set(l.id, 'Centro e plano repetidos');
      vistos.add(chave);
    }
  }
  const somaPct = aprop.reduce((t, l) => { const p = paraNumero(l.percentual); return Number.isFinite(p) ? t + p : t; }, 0);
  const somaOk = Math.abs(somaPct - 100) <= 0.0001;

  // ---------- apropriação de obra ----------
  const chaveUnidades = (obra: string) => `o:${obra}`;
  const chaveItens = (obra: string, unidade: string) => `u:${obra}|${unidade}`;
  const patchObra = (id: string, p: Partial<LinhaObra>) =>
    this.setState(st => ({ ntApropObra: (st.ntApropObra || []).map((l: LinhaObra) => (l.id === id ? { ...l, ...p } : l)) }));

  /** Busca no Sienge as unidades da obra (ou os itens da unidade), uma vez por chave. */
  const carregarOrcamento = async (obra: string, unidade = '', linhaId?: string) => {
    if (!/^\d+$/.test(obra)) return;
    const chave = unidade ? chaveItens(obra, unidade) : chaveUnidades(obra);
    const atual: CargaOrcamento | undefined = (this.state.ntOrc || {})[chave];
    if (atual && (atual.carregando || atual.dados)) return;
    const marcar = (c: CargaOrcamento) => this.setState(st => ({ ntOrc: { ...(st.ntOrc || {}), [chave]: c } }));
    marcar({ carregando: true, erro: '', dados: null });
    try {
      const dados = await titulosApi.orcamento(Number(obra), unidade ? Number(unidade) : null);
      marcar({ carregando: false, erro: '', dados });
      // Uma só unidade construtiva liberada: já fica escolhida.
      const livres = dados.unidades.filter(u => !u.bloqueada);
      if (!unidade && linhaId && livres.length === 1) {
        const linha = (this.state.ntApropObra || []).find((l: LinhaObra) => l.id === linhaId);
        if (linha && linha.obra === obra && !linha.unidade) {
          patchObra(linhaId, { unidade: String(livres[0].id) });
          carregarOrcamento(obra, String(livres[0].id));
        }
      }
    } catch (e: any) {
      marcar({ carregando: false, erro: erroDe(e), dados: null });
    }
  };

  /** A obra é digitada: espera parar de digitar antes de consultar o Sienge. */
  const escolherObra = (linhaId: string, obra: string) => {
    patchObra(linhaId, { obra, unidade: '', item: '' });
    this._ntObraTimers ??= {};
    clearTimeout(this._ntObraTimers[linhaId]);
    if (/^\d+$/.test(obra)) this._ntObraTimers[linhaId] = setTimeout(() => carregarOrcamento(obra, '', linhaId), 450);
  };

  const recarregarOrcamento = (obra: string, unidade = '') => {
    const chave = unidade ? chaveItens(obra, unidade) : chaveUnidades(obra);
    this.setState(st => { const o = { ...(st.ntOrc || {}) }; delete o[chave]; return { ntOrc: o }; }, () => carregarOrcamento(obra, unidade));
  };

  const obrasPreenchidas = apropObra.filter(l => !linhaObraVazia(l));
  const problemasObra = new Map<string, string>();
  const vistosObra = new Set<string>();
  for (const l of obrasPreenchidas) {
    const p = paraNumero(l.percentual);
    const obra = l.obra.trim();
    const cargaObra = orc[chaveUnidades(obra)];
    const cargaItens = l.unidade ? orc[chaveItens(obra, l.unidade)] : undefined;
    if (!/^\d+$/.test(obra)) problemasObra.set(l.id, 'Informe a obra');
    else if (cargaObra?.erro) problemasObra.set(l.id, cargaObra.erro);
    else if (!l.unidade) problemasObra.set(l.id, 'Escolha a unidade construtiva');
    else if (cargaItens?.erro) problemasObra.set(l.id, cargaItens.erro);
    else if (!l.item.trim()) problemasObra.set(l.id, 'Escolha o item do orçamento');
    else if (cargaItens?.dados && !cargaItens.dados.itens.some(i => i.codigo === l.item.trim())) problemasObra.set(l.id, 'Item não encontrado no orçamento desta unidade');
    else if (!Number.isFinite(p) || p <= 0 || p > 100) problemasObra.set(l.id, 'Percentual entre 0 e 100');
    else {
      const chave = `${obra}|${l.unidade}|${l.item.trim()}`;
      if (vistosObra.has(chave)) problemasObra.set(l.id, 'Obra, unidade e item repetidos');
      vistosObra.add(chave);
    }
  }
  const somaPctObra = obrasPreenchidas.reduce((t, l) => { const p = paraNumero(l.percentual); return Number.isFinite(p) ? t + p : t; }, 0);
  const somaObraOk = Math.abs(somaPctObra - 100) <= 0.0001;
  const carregandoOrcamento = Object.values(orc).some(c => c.carregando);

  const pendencias = [
    ...(analise && analise.bloqueios.length ? ['Resolva os bloqueios acima.'] : []),
    ...(!analise?.fornecedor ? ['Credor não localizado no Sienge.'] : []),
    ...(!analise?.empresa ? ['Informe a empresa.'] : []),
    ...(!String(cab.numero || '').trim() ? ['Informe o número do documento.'] : []),
    ...(!Number.isFinite(valor) || valor <= 0 ? ['Informe o valor do título.'] : []),
    ...(!Number.isFinite(desconto) || desconto < 0 || (Number.isFinite(valor) && desconto >= valor) ? ['Desconto deve ser menor que o valor.'] : []),
    ...(!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS ? [`Parcelas de 1 a ${MAX_PARCELAS}.`] : []),
    ...(!cab.dataEmissao ? ['Informe a data de emissão.'] : []),
    ...(!cab.dataCompetencia ? ['Informe a competência.'] : []),
    ...(!cab.dataBase ? ['Informe a data base.'] : []),
    ...(!cab.vencimento ? ['Informe o vencimento.'] : []),
    ...(aprop.length === 0 ? ['Adicione uma apropriação financeira.'] : []),
    ...(problemasLinha.size ? ['Corrija as apropriações destacadas.'] : []),
    ...(aprop.length && !somaOk ? ['As apropriações devem somar 100%.'] : []),
    ...(problemasObra.size ? ['Corrija as apropriações de obra destacadas.'] : []),
    ...(obrasPreenchidas.length && !somaObraOk ? ['As apropriações de obra devem somar 100%.'] : []),
    ...(carregandoOrcamento ? ['Aguarde o orçamento da obra carregar.'] : []),
    ...(!descricaoPrincipal.trim() || anexos.some(a => !a.descricao.trim()) ? ['Informe a descrição de todos os anexos.'] : []),
    ...(!podeEditar ? ['Seu perfil só pode consultar os títulos cadastrados.'] : []),
  ];

  const liberarVencimento = async () => {
    if (!senha.digitada || busy) return;
    set({ ntBusy: 'senha' });
    try {
      await titulosApi.liberarVencimento(senha.digitada);
      this.setState({ ntBusy: '' });
      patchSenha({ liberada: senha.digitada, pedindo: false, erro: '' });
    } catch (e: any) {
      this.setState({ ntBusy: '' });
      patchSenha({ erro: e?.status === 403 ? 'Senha incorreta.' : 'Não foi possível verificar a senha.' });
    }
  };

  const adicionarAnexos = async (arquivos: FileList | null) => {
    if (!arquivos || !arquivos.length || !s.ntArquivo) return;
    const lista = Array.from(arquivos);
    set({ ntBusy: 'anexos' });
    try {
      this._ntDigital ??= impressaoDigital(s.ntArquivo);
      const principal = await this._ntDigital;
      const ids = new Set(anexos.map(a => a.id));
      const novos: AnexoExtra[] = [];
      const recusados: string[] = [];
      for (const arquivo of lista) {
        if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) { recusados.push(`${arquivo.name}: envie apenas arquivos PDF.`); continue; }
        if (arquivo.size > MAX_BYTES_PDF) {
          recusados.push(`${arquivo.name}: ${formatarTamanho(arquivo.size)} passa do limite de ${formatarTamanho(MAX_BYTES_PDF)}. Comprima o PDF e tente de novo.`);
          continue;
        }
        const digital = await impressaoDigital(arquivo);
        if (digital === principal) { recusados.push(`${arquivo.name}: é o mesmo PDF enviado para cadastro — ele já vai anexado automaticamente.`); continue; }
        if (ids.has(digital)) { recusados.push(`${arquivo.name}: este arquivo já está na lista.`); continue; }
        ids.add(digital);
        novos.push({ id: digital, arquivo, descricao: sugerirDescricao(arquivo.name) });
      }
      this.setState(st => ({ ntBusy: '', ntRecusados: recusados, ntAnexos: (st.ntAnexos || []).concat(novos) }));
    } catch {
      set({ ntBusy: '', ntRecusados: ['Não foi possível ler os arquivos selecionados.'] });
    }
  };

  const marcarEnvio = (id: string, status: StatusEnvio, erro?: string) =>
    this.setState(st => ({ ntEnvios: (st.ntEnvios || []).map((e: EnvioAnexo) => (e.id === id ? { ...e, status, erro } : e)) }));

  const anexar = async (billId: number, a: AnexoExtra, tituloId?: string | null) => {
    marcarEnvio(a.id, 'enviando');
    try {
      await titulosApi.anexar(billId, a.arquivo, a.descricao.trim(), tituloId);
      marcarEnvio(a.id, 'anexado');
    } catch (e: any) {
      marcarEnvio(a.id, 'falhou', erroDe(e));
    }
  };

  const cadastrar = async () => {
    if (!analise || !analise.fornecedor || !analise.empresa || pendencias.length || busy) return;
    set({ ntBusy: 'cadastrar', ntErro: '' });
    const corpo: TituloCorpo = {
      fornecedorId: analise.fornecedor.id,
      empresaId: analise.empresa.id,
      tipoDocumento: tipo,
      documentId: documento,
      numero: String(cab.numero).trim(),
      dataEmissao: cab.dataEmissao,
      dataCompetencia: cab.dataCompetencia,
      dataBase: cab.dataBase,
      parcelas,
      valor,
      desconto,
      observacao: String(cab.obs || '').slice(0, MAX_OBSERVACAO_TITULO),
      apropriacoes: aprop.map(l => ({ centroCustoId: Number(l.centro), planoFinanceiroId: l.plano.trim(), percentual: paraNumero(l.percentual) })),
      apropriacoesObra: obrasPreenchidas.map(l => ({ obraId: Number(l.obra), unidadeId: Number(l.unidade), itemId: l.item.trim(), percentual: paraNumero(l.percentual) })),
      pdfBase64: this._ntPdf,
      nomeArquivo: s.ntArquivo?.name || 'titulo.pdf',
      descricaoAnexo: descricaoPrincipal.trim(),
      ...(senha.liberada !== null ? { vencimentoManual: { data: cab.vencimento, senha: senha.liberada } } : {}),
    };
    try {
      const resultado = await titulosApi.cadastrar(corpo);
      const extras = anexos;
      set({
        ntBusy: '', ntEtapa: 'concluido', ntResultado: resultado,
        ntEnvios: extras.map(a => ({ ...a, status: resultado.billId ? 'pendente' : 'sem_titulo' })),
      });
      this.loadNtHistorico();
      // Anexos extras sobem um por vez, depois que o Sienge gerou o título.
      if (resultado.billId) {
        for (const a of extras) await anexar(resultado.billId, a, resultado.tituloId);
        if (extras.length) this.loadNtHistorico();
      }
    } catch (e: any) {
      const rede = !e?.status;
      set({
        ntBusy: '',
        ntErro: rede ? 'Não foi possível falar com o servidor. Verifique no Sienge se o título foi criado antes de tentar de novo.' : erroDe(e),
      });
    }
  };

  const papeis = PAPEIS[tipo];
  const resultado = s.ntResultado;
  const envios: EnvioAnexo[] = s.ntEnvios || [];
  const activeItem = ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997';
  const passos = ['Envio', 'Conferência', 'Cadastrado'];
  const idxEtapa = ['envio', 'conferencia', 'concluido'].indexOf(etapa);

  return {
    nfTitulosItemStyle: s.page === 'nfTitulos' ? subItemStyle + activeItem : subItemStyle,
    goNfTitulos: (e?: any) => { if (e && e.preventDefault) e.preventDefault(); if (this.semAcesso(podeVer)) return; irPara({}); },
    isNfTitulos: s.page === 'nfTitulos',

    nt: {
      etapa,
      podeEditar,
      passos: passos.map((label, i) => ({ label, numero: i + 1, estado: i < idxEtapa ? 'feito' : i === idxEtapa ? 'atual' : 'futuro' })),
      busy,
      erro: s.ntErro || '',
      novo: () => {
        if (!podeEditar) { this.toast(semPermissao); return; }
        recomecar({ ntEtapa: 'envio' });
      },
      cancelar: () => {
        if (busy === 'cadastrar') return;
        if (etapa === 'conferencia' && !window.confirm('Sair sem cadastrar? Os dados conferidos serão perdidos.')) return;
        recomecar();
      },

      // histórico
      carregando: s.ntLista == null,
      historico,
      totalLabel: `${lista.length} ${lista.length === 1 ? 'título cadastrado' : 'títulos cadastrados'} pelo app`,
      rangeLabel: lista.length ? `Mostrando ${filtrada.length} de ${lista.length}` : 'Nenhum título cadastrado ainda',
      busca: s.ntBusca || '',
      onBusca: (e: any) => set({ ntBusca: e.target.value }),
      situacaoTabs: ['Todos', 'Com pendência'].map(t => ({ label: t, ativo: situacao === t, onClick: () => set({ ntSituacao: t }) })),
      filtrado: !!q || situacao !== 'Todos',
      limparFiltros: () => set({ ntBusca: '', ntSituacao: 'Todos' }),
      recarregar: () => this.loadNtHistorico(true),
      aberto: s.ntAbertoId || null,
      alternar: (id: string) => this.setState(st => ({ ntAbertoId: st.ntAbertoId === id ? null : id })),

      // 1. envio
      arquivo: s.ntArquivo ? { nome: s.ntArquivo.name, tamanho: formatarTamanho(s.ntArquivo.size) } : null,
      limiteLabel: formatarTamanho(MAX_BYTES_PDF),
      onArquivo: (e: any) => { const f = e.target.files?.[0]; e.target.value = ''; escolherArquivo(f); },
      onSoltar: (e: any) => { e.preventDefault(); set({ ntArrastando: false }); escolherArquivo(e.dataTransfer?.files?.[0]); },
      arrastando: !!s.ntArrastando,
      onArrastar: (e: any) => { e.preventDefault(); if (!s.ntArrastando) set({ ntArrastando: true }); },
      onSair: () => set({ ntArrastando: false }),
      removerArquivo: () => { this._ntDigital = null; set({ ntArquivo: null, ntErro: '' }); },
      analisar,

      // 2. conferência
      conf: analise ? {
        bloqueios: analise.bloqueios,
        avisos: analise.avisos,
        tipo: documento,
        tipos: opcoesDocumento(analise),
        onTipo: (e: any) => {
          const codigo = e.target.value;
          const t = (Object.keys(analise.documentIds) as TipoDocumento[]).find(k => analise.documentIds[k] === codigo);
          set({ ntDocumento: codigo, ntTipo: t ?? analise.documento.tipoDocumento });
        },
        tipoDetalhe: documento === documentoPadrao
          ? `Identificado no PDF: ${NOMES_TIPO[analise.documento.tipoDocumento]}`
          : `Alterado · o PDF foi identificado como ${NOMES_TIPO[analise.documento.tipoDocumento]} (${documentoPadrao})`,
        numero: cab.numero ?? '', onNumero: (e: any) => patchCab({ numero: e.target.value }),
        valor: cab.valor ?? '', onValor: (e: any) => patchCab({ valor: e.target.value.replace(/[^\d.,]/g, '') }),
        valorLido: fmtMoeda(analise.cabecalho.valorTotal),
        valorAlterado: Number.isFinite(valor) && Math.abs(valor - analise.cabecalho.valorTotal) > 0.004,
        desconto: cab.desconto ?? '', onDesconto: (e: any) => patchCab({ desconto: e.target.value.replace(/[^\d.,]/g, '') }),
        parcelas: cab.parcelas ?? '1', onParcelas: (e: any) => patchCab({ parcelas: e.target.value.replace(/\D/g, '').slice(0, 3) }),
        maxParcelas: MAX_PARCELAS,
        liquido: Number.isFinite(valor) && Number.isFinite(desconto) ? fmtMoeda(valor - desconto) : '—',
        dataEmissao: cab.dataEmissao ?? '', onDataEmissao: (e: any) => patchCab({ dataEmissao: e.target.value }),
        dataCompetencia: cab.dataCompetencia ?? '', onDataCompetencia: (e: any) => patchCab({ dataCompetencia: e.target.value }),
        dataBase: cab.dataBase ?? '', onDataBase: (e: any) => patchCab({ dataBase: e.target.value }),
        fornecedorRotulo: `Credor (CNPJ do ${papeis.vendedor})`,
        fornecedor: analise.fornecedor ? `${analise.fornecedor.id} — ${analise.fornecedor.nome}` : 'Não encontrado',
        fornecedorCnpj: analise.fornecedor?.cnpj || analise.documento.fornecedorCnpj || '',
        empresaRotulo: `Empresa (CNPJ do ${papeis.comprador})`,
        empresa: analise.empresa ? `${analise.empresa.id} — ${analise.empresa.nome}` : 'Não encontrada',
        empresaCnpj: analise.empresa?.cnpj || analise.documento.destinatarioCnpj || '',
        trocarEmpresa: () => set({ ntEmpresaModal: { codigo: '', erro: '', enviando: false } }),
        empresaNaoLocalizada: analise.empresaNaoLocalizada,
        empresaModal: empresaModal ? {
          codigo: empresaModal.codigo,
          onCodigo: (e: any) => patchEmpresaModal({ codigo: e.target.value.replace(/\D/g, ''), erro: '' }),
          erro: empresaModal.erro,
          enviando: empresaModal.enviando,
          fechar: () => { if (!empresaModal.enviando) set({ ntEmpresaModal: null }); },
          confirmar: confirmarEmpresa,
        } : null,
        obs: cab.obs ?? '', onObs: (e: any) => patchCab({ obs: e.target.value.slice(0, MAX_OBSERVACAO_TITULO) }),
        maxObs: MAX_OBSERVACAO_TITULO,
        observacaoAutomatica: 'Título cadastrado via Externo.',

        // vencimento (senha)
        vencimento: cab.vencimento ?? '',
        vencimentoMin: new Date().toISOString().slice(0, 10),
        vencimentoEditavel: analise.vencimentoEditavel,
        vencimentoLiberado: senha.liberada !== null,
        onVencimento: (e: any) => patchCab({ vencimento: e.target.value }),
        pedirSenha: () => { if (senha.liberada === null && analise.vencimentoEditavel) patchSenha({ pedindo: true, digitada: '', erro: '' }); },
        pedindoSenha: !!senha.pedindo,
        senhaDigitada: senha.digitada,
        onSenha: (e: any) => patchSenha({ digitada: e.target.value }),
        onSenhaKey: (e: any) => { if (e.key === 'Enter') liberarVencimento(); if (e.key === 'Escape') patchSenha({ pedindo: false }); },
        liberar: liberarVencimento,
        cancelarSenha: () => patchSenha({ pedindo: false }),
        senhaErro: senha.erro,
        verificandoSenha: busy === 'senha',
        restaurarVencimento: () => { patchSenha({ liberada: null }); patchCab({ vencimento: analise.cabecalho.vencimento }); },
        vencimentoDocumento: analise.cabecalho.vencimentoDocumento ? fmtData(analise.cabecalho.vencimentoDocumento) : '',

        // apropriação financeira
        centrosOpcoes: centros.filter(c => c.ativo !== false).map(c => ({ value: String(c.id), label: c.nome })),
        planosOpcoes: planos.map(p => ({ value: p.id, label: p.nome })),
        apropriacoes: aprop.map(l => {
          const p = paraNumero(l.percentual);
          const centro = /^\d+$/.test(l.centro.trim()) ? centros.find(c => String(c.id) === l.centro.trim()) : null;
          return {
            id: l.id,
            centro: l.centro, onCentro: (e: any) => patchLinha(l.id, { centro: e.target.value.replace(/\D/g, '') }),
            centroNome: centro ? centro.nome : '',
            plano: l.plano, onPlano: (e: any) => patchLinha(l.id, { plano: e.target.value.replace(/\D/g, '') }),
            planoNome: planoPorId.get(l.plano.trim()) || '',
            percentual: l.percentual, onPercentual: (e: any) => patchLinha(l.id, { percentual: e.target.value.replace(/[^\d.,]/g, '') }),
            valor: Number.isFinite(p) && Number.isFinite(valor) ? fmtMoeda(doisDecimais((valor * p) / 100)) : '—',
            problema: problemasLinha.get(l.id) || '',
            remover: aprop.length > 1 ? () => this.setState(st => ({ ntAprop: (st.ntAprop || []).filter((x: LinhaApropriacao) => x.id !== l.id) })) : null,
          };
        }),
        podeAdicionar: aprop.length < MAX_APROPRIACOES,
        adicionar: () => {
          if (aprop.length >= MAX_APROPRIACOES) return;
          const resto = Math.max(0, Math.round((100 - somaPct) * 10_000) / 10_000);
          this.setState(st => ({ ntAprop: (st.ntAprop || []).concat(novaLinha(resto ? pct.format(resto) : '')) }));
        },
        dividir: () => {
          const n = aprop.length;
          if (!n) return;
          // Partes iguais com 4 casas; a última fecha os 100%.
          const parte = Math.floor((100 / n) * 10_000) / 10_000;
          const ultima = Math.round((100 - parte * (n - 1)) * 10_000) / 10_000;
          this.setState(st => ({ ntAprop: (st.ntAprop || []).map((l: LinhaApropriacao, i: number) => ({ ...l, percentual: pct.format(i === n - 1 ? ultima : parte) })) }));
        },
        totalPct: `${pct.format(Math.round(somaPct * 10_000) / 10_000)}%`,
        somaOk,

        // apropriação de obra
        obrasOpcoes: centros.filter(c => c.ativo !== false).map(c => ({ value: String(c.id), label: c.nome })),
        apropriacoesObra: apropObra.map(l => {
          const p = paraNumero(l.percentual);
          const obra = l.obra.trim();
          const cargaObra = orc[chaveUnidades(obra)];
          const cargaItens = l.unidade ? orc[chaveItens(obra, l.unidade)] : undefined;
          const unidades = cargaObra?.dados?.unidades || [];
          const itens = cargaItens?.dados?.itens || [];
          const item = itens.find(i => i.codigo === l.item.trim());
          const centro = /^\d+$/.test(obra) ? centros.find(c => String(c.id) === obra) : null;
          // Sugestão: a obra costuma ter o mesmo código do centro de custo da apropriação financeira.
          const sugerida = !obra ? aprop.map(a => a.centro.trim()).find(c => /^\d+$/.test(c)) || '' : '';
          return {
            id: l.id,
            obra: l.obra, onObra: (e: any) => escolherObra(l.id, e.target.value.replace(/\D/g, '')),
            obraNome: cargaObra?.carregando ? 'Buscando a obra no Sienge…'
              : cargaObra?.erro ? ''
              : cargaObra?.dados ? (cargaObra.dados.obraNome || centro?.nome || `Obra ${obra}`) : '',
            obraErro: cargaObra?.erro || '',
            recarregarObra: cargaObra?.erro ? () => recarregarOrcamento(obra) : null,
            sugerida,
            usarSugerida: sugerida ? () => escolherObra(l.id, sugerida) : null,
            unidade: l.unidade,
            unidadesOpcoes: unidades.map(u => ({ value: String(u.id), label: `${u.id} — ${u.nome}${u.bloqueada ? ' (bloqueada)' : ''}` })),
            unidadeDesabilitada: !cargaObra?.dados || !unidades.length,
            unidadeDica: cargaObra?.dados && !unidades.length ? 'A obra não tem orçamento' : '',
            onUnidade: (e: any) => {
              const unidade = e.target.value;
              patchObra(l.id, { unidade, item: '' });
              if (unidade) carregarOrcamento(obra, unidade);
            },
            item: l.item,
            itensOpcoes: itens.map(i => ({ value: i.codigo, label: i.nome })),
            itemDesabilitado: !cargaItens?.dados,
            onItem: (e: any) => patchObra(l.id, { item: e.target.value }),
            itemNome: cargaItens?.carregando ? 'Carregando os itens do orçamento…'
              : item ? `${item.nome}${item.unidadeMedida ? ` · ${item.unidadeMedida}` : ''}`
              : cargaItens?.dados ? (itens.length ? `${itens.length} itens apropriáveis · busque pelo nome ou código` : 'Nenhum item apropriável nesta unidade') : '',
            recarregarItens: cargaItens?.erro ? () => recarregarOrcamento(obra, l.unidade) : null,
            percentual: l.percentual, onPercentual: (e: any) => patchObra(l.id, { percentual: e.target.value.replace(/[^\d.,]/g, '') }),
            valor: Number.isFinite(p) && Number.isFinite(valor) && !linhaObraVazia(l) ? fmtMoeda(doisDecimais((valor * p) / 100)) : '—',
            problema: problemasObra.get(l.id) || '',
            remover: () => this.setState(st => ({ ntApropObra: (st.ntApropObra || []).filter((x: LinhaObra) => x.id !== l.id) })),
          };
        }),
        podeAdicionarObra: apropObra.length < MAX_APROPRIACOES,
        adicionarObra: () => {
          if (apropObra.length >= MAX_APROPRIACOES) return;
          const resto = Math.max(0, Math.round((100 - somaPctObra) * 10_000) / 10_000);
          this.setState(st => ({ ntApropObra: (st.ntApropObra || []).concat(novaLinhaObra(resto ? pct.format(resto) : '')) }));
        },
        dividirObra: () => {
          const n = apropObra.length;
          if (!n) return;
          const parte = Math.floor((100 / n) * 10_000) / 10_000;
          const ultima = Math.round((100 - parte * (n - 1)) * 10_000) / 10_000;
          this.setState(st => ({ ntApropObra: (st.ntApropObra || []).map((l: LinhaObra, i: number) => ({ ...l, percentual: pct.format(i === n - 1 ? ultima : parte) })) }));
        },
        totalPctObra: `${pct.format(Math.round(somaPctObra * 10_000) / 10_000)}%`,
        somaObraOk,
        semObra: obrasPreenchidas.length === 0,

        // anexos
        nomePrincipal: s.ntArquivo?.name || '',
        descricaoPrincipal,
        onDescricaoPrincipal: (e: any) => set({ ntDescPrincipal: e.target.value }),
        sugestoesAnexo: SUGESTOES_ANEXO,
        maxDescricao: MAX_DESCRICAO_ANEXO,
        anexos: anexos.map(a => ({
          id: a.id,
          nome: a.arquivo.name,
          tamanho: formatarTamanho(a.arquivo.size),
          descricao: a.descricao,
          onDescricao: (e: any) => this.setState(st => ({ ntAnexos: (st.ntAnexos || []).map((x: AnexoExtra) => (x.id === a.id ? { ...x, descricao: e.target.value } : x)) })),
          remover: () => this.setState(st => ({ ntAnexos: (st.ntAnexos || []).filter((x: AnexoExtra) => x.id !== a.id) })),
        })),
        recusados: s.ntRecusados || [],
        lendoAnexos: busy === 'anexos',
        onAnexos: (e: any) => { const l = e.target.files; adicionarAnexos(l).finally(() => { e.target.value = ''; }); },

        // rodapé
        pendencias,
        cadastrando: busy === 'cadastrar',
        cadastrar,
        voltar: () => { if (busy !== 'cadastrar') set({ ntEtapa: 'envio', ntAnalise: null, ntErro: '' }); },
        resumo: `${fmtMoeda(valor)} em ${Number.isInteger(parcelas) && parcelas > 0 ? parcelas : '—'}x · vencimento ${fmtData(cab.vencimento)} · ${aprop.length} apropriaç${aprop.length === 1 ? 'ão' : 'ões'}${obrasPreenchidas.length ? ` + ${obrasPreenchidas.length} de obra` : ' · sem obra'} · ${anexos.length + 1} anexo${anexos.length ? 's' : ''}`,
      } : null,

      // 3. concluído
      resultado: resultado ? {
        mensagem: resultado.message,
        titulo: resultado.billId ? String(resultado.billId) : 'não identificado',
        avisos: resultado.avisos as string[],
        semTitulo: envios.some(e => e.status === 'sem_titulo'),
        envios: envios.map(e => ({
          id: e.id,
          descricao: e.descricao,
          nome: e.arquivo.name,
          erro: e.erro || '',
          status: e.status,
          rotulo: ROTULOS_ENVIO[e.status],
          reenviar: () => { if (resultado.billId) anexar(resultado.billId, e, resultado.tituloId).then(() => this.loadNtHistorico()); },
        })),
        enviando: envios.some(e => e.status === 'pendente' || e.status === 'enviando'),
      } : null,
      outra: () => recomecar({ ntEtapa: 'envio' }),
      verHistorico: () => recomecar(),
    },
  };
}
