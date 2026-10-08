import type { AppLogic } from '../AppLogic';
import { tomticketApi, type ChamadoPreparado, type OrigemChamado } from '../../lib/tomticket';

// Chamado de conferência do título no TomTicket, compartilhado por Notas Fiscais › Cadastros
// (nfChamado) e › Título a Pagar (ntChamado). Tela: ChamadoCard/ChamadoModal em screens/nf/ui.tsx.

/** Estado do modal (null = fechado e ainda não criado). */
interface ChamadoState {
  aberto: boolean; carregando: boolean; enviando: boolean; erro: string;
  dados: ChamadoPreparado | null; categoriaId: string; mensagem: string;
  criado: boolean; protocolo: string | null;
}

type ChaveChamado = 'nfChamado' | 'ntChamado';

/** Props do card/modal do chamado para o título `billId` (null quando o Sienge não informou o título). */
export function chamadoVals(this: AppLogic, chave: ChaveChamado, origem: OrigemChamado, billId: number | null | undefined) {
  if (!billId) return null;
  const erroDe = (e: any) => e?.message || 'Não foi possível falar com o servidor.';
  const chamado: ChamadoState | null = (this.state as any)[chave];
  const setChamado = (patch: Partial<ChamadoState>) => this.setState((st: any) => ({ [chave]: { ...st[chave], ...patch } }));

  const abrir = async () => {
    if (chamado?.carregando) return;
    this.setState({ [chave]: { aberto: true, carregando: true, enviando: false, erro: '', dados: null, categoriaId: '', mensagem: '', criado: false, protocolo: null } });
    try {
      const dados = await tomticketApi.preparar(billId, origem);
      setChamado({ carregando: false, dados, categoriaId: dados.categoriaPadraoId || '', mensagem: dados.mensagem });
    } catch (e: any) {
      setChamado({ carregando: false, erro: erroDe(e) });
    }
  };

  const criar = async () => {
    const c: ChamadoState | null = (this.state as any)[chave];
    if (!c?.dados || c.enviando) return;
    if (!c.categoriaId) { setChamado({ erro: 'Escolha a categoria do chamado.' }); return; }
    if (!c.mensagem.trim()) { setChamado({ erro: 'Escreva a mensagem do chamado.' }); return; }
    setChamado({ enviando: true, erro: '' });
    try {
      const r = await tomticketApi.criar(billId, c.categoriaId, c.mensagem.trim(), origem);
      setChamado({ enviando: false, aberto: false, criado: true, protocolo: r.protocolo });
      this.toast(r.protocolo ? `Chamado ${r.protocolo} aberto no TomTicket.` : 'Chamado aberto no TomTicket.');
    } catch (e: any) {
      setChamado({ enviando: false, erro: erroDe(e) });
    }
  };

  return {
    titulo: String(billId),
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
    abrir,
    fechar: () => { if (!chamado?.enviando) setChamado({ aberto: false, erro: '' }); },
    onCategoria: (e: any) => setChamado({ categoriaId: e.target.value, erro: '' }),
    onMensagem: (e: any) => setChamado({ mensagem: e.target.value, erro: '' }),
    criar,
  };
}
