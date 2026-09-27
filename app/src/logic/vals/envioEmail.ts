import type { AppLogic } from '../AppLogic';
import { apoioApi } from '../../lib/api';

// "Enviar por e-mail": modal genérico que manda um PDF gerado pela tela para uma lista de
// e-mails, pela edge function app-email. Qualquer tela abre com app.abrirEnvioEmail(envio);
// o assunto e o corpo saem do modelo do `tipo` na função (MODELOS em app-email/index.ts),
// então liberar uma tela nova = um modelo lá + uma chamada aqui.

export type EnvioEmail = {
  /** Chave do modelo de e-mail na edge function (ex.: 'analise-prog'). */
  tipo: string;
  /** Título do modal ("Análise com IA · Programação do dia"). */
  titulo: string;
  /** Período que vai no assunto e no corpo ("26/09/2026 a 05/10/2026"). */
  periodo: string;
  arquivo: string;
  /** Prévia do assunto e do corpo, igual ao que a função monta. */
  assunto: string;
  corpo: string;
  /** Gera o PDF em base64 na hora do envio (com os dados que estão na tela). */
  gerarPdf: () => Promise<string>;
};

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const MAX_DESTINATARIOS = 10;

/** "a@x.com; b@y.com, c@z.com" → lista sem repetidos; `invalidos` traz o que não é e-mail. */
export function lerDestinatarios(texto: string) {
  const partes = String(texto || '').split(/[\s,;]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
  const unicos = [...new Set(partes)];
  return { validos: unicos.filter(p => EMAIL_RE.test(p)), invalidos: unicos.filter(p => !EMAIL_RE.test(p)) };
}

export function abrirEnvioEmail(this: AppLogic, envio: EnvioEmail) {
  this.setState({ envioEmail: { envio, para: '', busy: false, erro: '' } });
}

export async function enviarEmail(this: AppLogic) {
  const cur = this.state.envioEmail;
  if (!cur || cur.busy) return;
  const set = (patch: any) => this.setState(st => ({ envioEmail: st.envioEmail ? { ...st.envioEmail, ...patch } : null }));
  const { validos, invalidos } = lerDestinatarios(cur.para);
  if (invalidos.length) return set({ erro: `E-mail inválido: ${invalidos.join(', ')}` });
  if (!validos.length) return set({ erro: 'Informe ao menos um e-mail.' });
  if (validos.length > MAX_DESTINATARIOS) return set({ erro: `No máximo ${MAX_DESTINATARIOS} destinatários por envio.` });
  set({ busy: true, erro: '' });
  try {
    const { envio } = cur;
    const pdf = await envio.gerarPdf();
    await apoioApi.enviarEmail({ tipo: envio.tipo, periodo: envio.periodo, para: validos, arquivo: envio.arquivo, pdf });
    this.setState({ envioEmail: null });
    this.toast(validos.length === 1 ? `Enviado para ${validos[0]}.` : `Enviado para ${validos.length} destinatários.`);
  } catch (e: any) {
    console.error('Envio por e-mail:', e);
    set({
      busy: false,
      erro: e?.status === 503 ? 'O envio de e-mail ainda não foi configurado no servidor.' : e?.message || 'Não foi possível enviar o e-mail.',
    });
  }
}

export function envioEmailVals(this: AppLogic) {
  const cur = this.state.envioEmail;
  const user = this.props.session?.user;
  const meta = user?.user_metadata || {};
  const nome = meta.full_name || meta.name || '';
  const email = user?.email || '';
  return {
    envioEmailOpen: !!cur,
    envioEmailTitulo: cur?.envio.titulo || '',
    envioEmailArquivo: cur?.envio.arquivo || '',
    envioEmailAssunto: cur?.envio.assunto || '',
    envioEmailCorpo: cur?.envio.corpo || '',
    envioEmailDe: nome ? `${nome} <${email}>` : email || 'Usuário logado',
    envioEmailPara: cur?.para || '',
    envioEmailBusy: !!cur?.busy,
    envioEmailErro: cur?.erro || '',
    setEnvioEmailPara: (v: string) => this.setState(st => ({ envioEmail: st.envioEmail ? { ...st.envioEmail, para: v, erro: '' } : null })),
    fecharEnvioEmail: () => { if (!this.state.envioEmail?.busy) this.setState({ envioEmail: null }); },
    enviarEmail: () => this.enviarEmail(),
  };
}
