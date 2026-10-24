// Permutas › Cadastro: dados e regras de cálculo (migrations 20261016100000_app_permutas.sql e
// 20261022100000_app_permutas_inativacao_historico.sql: inativação, inscrições e histórico).
import { supabase } from './supabase';

export const TIPOS_ANEXO = ['Contrato', 'Escritura', 'Matrícula', 'Aditivo', 'Outro'] as const;
export type TipoAnexo = (typeof TIPOS_ANEXO)[number];
export const MAX_ANEXO = 50 * 1024 * 1024;
const BUCKET = 'app-permutas';

export interface Negocio { id: string; nome: string }
export interface UnidadeCatalogo {
  enterprise_id: number; empreendimento: string | null; company_id: number | null;
  unidade_id: number; unidade: string; area_privativa: number | null;
  /** Maior data de entrega das unidades do empreendimento (Sienge), se houver. */
  entrega?: string | null;
}
/** Ficha do empreendimento/terreno na Visão Geral. */
export interface EmpreendimentoFicha {
  id: string; enterprise_id: number | null; nome: string;
  tipo: string | null; tipo_permuta: string | null; status: string | null; alerta: string | null; acao: string | null;
}
/** Unidade permutada cadastrada direto (sem permuta de área). */
export interface UnidadeDireta {
  id: string; enterprise_id: number; unidade_id: number | null; unidade_nome: string; area_privativa: number | null;
  valor_unidade: number | null; permutante: string | null; data_contrato: string | null; observacao: string | null;
}
export interface PermutaUnidade {
  id?: string; enterprise_id: number; unidade_id: number; unidade_nome: string;
  area_privativa: number | null; valor_unidade: number | null; ordem?: number;
  /** Inativa: continua no cadastro, mas fora das somas e das outras telas. */
  ativo?: boolean; motivo_inativacao?: string | null;
}
export interface PermutaAnexo {
  id: string; tipo: TipoAnexo; descricao: string | null; nome: string; mime: string;
  tamanho: number; storage_path: string; adicionado_em: string;
}
export interface Permuta {
  id: string;
  empresa_id: number | null; negocio_id: string | null;
  permutante: string;
  /** CPF/CNPJ do permutante principal, só dígitos. */
  cpf_cnpj: string | null;
  num_matricula: string | null;
  area_matricula: number | null; coeficiente: number | null;
  /** Fração: 0,12 = 12%. */
  pct_permuta: number | null;
  area_propria: number | null; area_informada: number | null;
  observacao: string | null; pendencia: string | null;
  data_contrato?: string | null;
  cidade: string | null;
  inscricao_iptu: string | null; inscricao_equatorial: string | null; inscricao_saneago: string | null;
  ativo: boolean; motivo_inativacao: string | null;
  unidades: PermutaUnidade[];
  anexos: PermutaAnexo[];
}
/** O que o formulário grava; o status só muda por definirStatus (com motivo). */
export type PermutaDados = Omit<Permuta, 'id' | 'unidades' | 'anexos' | 'ativo' | 'motivo_inativacao'>;
/** Limites do motivo de inativação/reativação (o banco confere os mesmos). */
export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

/** Item do histórico (tabela app_permutas_historico; mais recente primeiro). */
export type AcaoHistorico = 'criado' | 'editado' | 'inativado' | 'reativado'
  | 'unidade_incluida' | 'unidade_editada' | 'unidade_removida' | 'unidade_inativada' | 'unidade_reativada';
export interface HistoricoItem {
  id: number; acao: AcaoHistorico; enterprise_id: number | null; unidade: string | null;
  /** Só os campos que mudaram: { campo: { de, para } }. */
  alteracoes: Record<string, { de: any; para: any }> | null;
  motivo: string | null; usuario: string | null; criado_em: string;
}

/** Só cadastros ativos e, neles, só as unidades ativas (Visão Geral e Insights). */
export const soAtivas = (l: Permuta[]): Permuta[] =>
  l.filter(p => p.ativo !== false).map(p => (p.unidades.every(u => u.ativo !== false) ? p : { ...p, unidades: p.unidades.filter(u => u.ativo !== false) }));
/** Arquivo escolhido na modal, enviado ao salvar. */
export interface AnexoNovo { file: File; tipo: TipoAnexo | ''; descricao: string }

// ---------- importar do contrato (edge function app-permutas) ----------
/** Limite da leitura por IA (o anexo em si aceita até 50 MB). */
export const MAX_CONTRATO_IA = 15 * 1024 * 1024;
export type NivelAviso = 'ok' | 'atencao' | 'info';
export interface AvisoImportacao { nivel: NivelAviso; texto: string }
/** Unidade principal citada no contrato (vagas e escaninhos vão na observação). */
export interface UnidadeContrato { empreendimento: string; cnpj: string | null; unidade: string; area_m2: number | null; extras: string | null }
/** Preenchimento sugerido a partir do contrato; pct_permuta em pontos percentuais (12 = 12%). */
export interface SugestaoContrato {
  permutante: string | null; cpf_cnpj: string | null; num_matricula: string | null; area_matricula: number | null; coeficiente: number | null;
  pct_permuta: number | null; area_propria: number | null; area_informada: number | null; data_contrato: string | null;
  cidade: string | null; inscricao_iptu: string | null; inscricao_equatorial: string | null; inscricao_saneago: string | null;
  observacao: string | null;
  empresa: { cnpj: string | null; nome: string | null };
  matriculas: string[];
  unidades: UnidadeContrato[];
}
export interface ImportacaoContrato {
  tipoDocumento: 'COMPROMISSO_PERMUTA' | 'ESCRITURA_PERMUTA' | 'OUTRO';
  sugestao: SugestaoContrato; avisos: AvisoImportacao[]; modelo: string; cache: boolean;
  /** "14 de 79" quando só o corpo do contrato foi lido; null no PDF escaneado ou no cache. */
  paginas: string | null;
}
// ---------- notificar por e-mail (edge function app-email, tipo "permuta") ----------
/** Usuário ativo do B2 sugerido como destinatário. */
export interface Destinatario { nome: string; email: string; departamento: string | null }
/** Os mesmos limites da edge function (ela confere de novo). */
export const MAX_DESTINATARIOS = 10;
export const MAX_ANEXO_EMAIL = 8 * 1024 * 1024;
export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Preço da unidade na tabela de vendas do mês do contrato (ou a mais próxima). */
export interface PrecoUnidade { enterprise_id: number; unidade: string; preco: number; mes_tabela: string }
const paraBase64 = (f: File) => new Promise<string>((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
  r.readAsDataURL(f);
});
/** Só os dígitos, para comparar CNPJ e matrículas escritos de jeitos diferentes. */
export const digitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
/** Máscara de CPF (até 11 dígitos) ou CNPJ (12 a 14) enquanto se digita. */
export function formatarCpfCnpj(v: string | null | undefined): string {
  const d = digitos(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
/** Dígitos verificadores de CPF (11 dígitos) ou CNPJ (14). */
export function cpfCnpjValido(v: string): boolean {
  const d = digitos(v);
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const dv = (b: string) => { let s = 0, w = b.length - 7; for (const c of b) { s += Number(c) * w--; if (w < 2) w = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
  }
  return false;
}

// ---------- regras de cálculo (as mesmas do Painel de Permutas) ----------
export interface Calculo { aprov: number | null; area: number | null; proprio: number; div: number | null; fonte: 'calc' | 'informada' }
const num = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** Aproveitamento = matrícula × coef.; Área de permuta = aproveitamento × %; Emp. diversos = área − próprio. */
export function calcular(p: Pick<Permuta, 'area_matricula' | 'coeficiente' | 'pct_permuta' | 'area_propria' | 'area_informada'>): Calculo {
  const aprov = num(p.area_matricula) && num(p.coeficiente) ? p.area_matricula * p.coeficiente : null;
  let area: number | null = null;
  let fonte: Calculo['fonte'] = 'calc';
  if (num(aprov) && num(p.pct_permuta)) area = aprov * p.pct_permuta;
  else if (num(p.area_informada)) { area = p.area_informada; fonte = 'informada'; }
  const proprio = num(p.area_propria) ? p.area_propria : 0;
  let div = area == null ? null : area - proprio;
  if (div != null && Math.abs(div) < 0.01) div = 0;
  return { aprov, area, proprio, div, fonte };
}

/** "1.250,00", "1250.5", "12%" → número; vazio → null. */
export function lerNumero(s: string): number | null {
  let t = String(s ?? '').trim().replace(/\s|m²|m2|%/gi, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isFinite(n) ? n : null;
}
const f2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const m2 = (v: number | null | undefined) => (num(v) ? f2.format(Math.abs(v) < 0.005 ? 0 : v) : '—');
export const pct = (v: number | null | undefined) => (num(v) ? f2.format(v * 100) + '%' : '—');
/** Número para o campo de texto: 1250.5 → "1250,5". */
export const paraCampo = (v: number | null | undefined, dec = 4) => (num(v) ? String(+v.toFixed(dec)).replace('.', ',') : '');
export const tamanho = (b: number) => (b >= 1048576 ? f2.format(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const nomeEmpreendimento = (u: { enterprise_id: number; empreendimento: string | null }) => u.empreendimento || `Empreendimento ${u.enterprise_id}`;

// ---------- acesso ao banco ----------
function sb() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}
function erro(e: { message: string; code?: string } | null) {
  if (!e) return;
  if (e.code === '42501') throw new Error('Seu perfil não tem permissão para esta alteração.');
  throw new Error(e.message);
}
const nomeArquivo = (s: string) =>
  (s || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-100);
const uuid = () => (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

const SEL = 'id, empresa_id, negocio_id, permutante, cpf_cnpj, num_matricula, area_matricula, coeficiente, pct_permuta, area_propria, area_informada, observacao, pendencia, data_contrato, '
  + 'cidade, inscricao_iptu, inscricao_equatorial, inscricao_saneago, ativo, motivo_inativacao, '
  + 'unidades:app_permuta_unidades(id, enterprise_id, unidade_id, unidade_nome, area_privativa, valor_unidade, ordem, ativo, motivo_inativacao), '
  + 'anexos:app_permuta_anexos(id, tipo, descricao, nome, mime, tamanho, storage_path, adicionado_em)';
const FICHA = 'id, enterprise_id, nome, tipo, tipo_permuta, status, alerta, acao';
const numOuNull = (v: any) => (v == null ? null : Number(v));
function normaliza(r: any): Permuta {
  return {
    ...r,
    area_matricula: numOuNull(r.area_matricula), coeficiente: numOuNull(r.coeficiente), pct_permuta: numOuNull(r.pct_permuta),
    area_propria: numOuNull(r.area_propria), area_informada: numOuNull(r.area_informada), ativo: r.ativo !== false,
    unidades: (r.unidades || []).map((u: any) => ({ ...u, ativo: u.ativo !== false, area_privativa: numOuNull(u.area_privativa), valor_unidade: numOuNull(u.valor_unidade) }))
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    anexos: (r.anexos || []).map((a: any) => ({ ...a, tamanho: Number(a.tamanho) || 0 }))
      .sort((a: any, b: any) => String(a.adicionado_em).localeCompare(String(b.adicionado_em))),
  };
}

export const permutasApi = {
  async carregar(): Promise<{ permutas: Permuta[]; negocios: Negocio[] }> {
    const [p, n] = await Promise.all([
      sb().from('app_permutas').select(SEL).order('criado_em'),
      sb().from('negocios_permuta').select('id, nome').order('nome'),
    ]);
    erro(p.error); erro(n.error);
    return { permutas: (p.data || []).map(normaliza), negocios: (n.data || []) as Negocio[] };
  },

  async visaoGeral(): Promise<{ fichas: EmpreendimentoFicha[]; diretas: UnidadeDireta[] }> {
    const [f, d] = await Promise.all([
      sb().from('app_permuta_empreendimentos').select(FICHA).order('nome'),
      sb().from('app_permuta_unidades_diretas').select('id, enterprise_id, unidade_id, unidade_nome, area_privativa, valor_unidade, permutante, data_contrato, observacao').order('criado_em'),
    ]);
    erro(f.error); erro(d.error);
    return {
      fichas: (f.data || []) as EmpreendimentoFicha[],
      diretas: ((d.data || []) as any[]).map(u => ({ ...u, area_privativa: numOuNull(u.area_privativa), valor_unidade: numOuNull(u.valor_unidade) })),
    };
  },
  async salvarFicha(f: Omit<EmpreendimentoFicha, 'id'> & { id?: string }): Promise<EmpreendimentoFicha> {
    const { id, ...dados } = f;
    const q = id ? sb().from('app_permuta_empreendimentos').update(dados).eq('id', id) : sb().from('app_permuta_empreendimentos').insert(dados);
    const { data, error } = await q.select(FICHA).single();
    erro(error);
    return data as EmpreendimentoFicha;
  },
  async excluirFicha(id: string): Promise<void> {
    erro((await sb().from('app_permuta_empreendimentos').delete().eq('id', id)).error);
  },
  async salvarDireta(u: Omit<UnidadeDireta, 'id'> & { id?: string }): Promise<void> {
    const { id, ...dados } = u;
    erro((await (id ? sb().from('app_permuta_unidades_diretas').update(dados).eq('id', id) : sb().from('app_permuta_unidades_diretas').insert(dados))).error);
  },
  async excluirDireta(id: string): Promise<void> {
    erro((await sb().from('app_permuta_unidades_diretas').delete().eq('id', id)).error);
  },

  async unidades(): Promise<UnidadeCatalogo[]> {
    // jsonb com arrays posicionais (o catálogo passa de 20 mil unidades; ver migration 20261019100000).
    const { data, error } = await sb().rpc('app_permutas_unidades');
    erro(error);
    return ((data || []) as any[]).map(([enterprise_id, empreendimento, company_id, unidade_id, unidade, area, entrega]) => ({
      enterprise_id, empreendimento, company_id, unidade_id, unidade: String(unidade), area_privativa: numOuNull(area), entrega,
    }));
  },

  /** Inativa ou reativa o cadastro (motivo obrigatório; o banco grava o histórico). */
  async definirStatus(id: string, ativo: boolean, motivo: string): Promise<void> {
    erro((await sb().rpc('app_permuta_status', { p_id: id, p_ativo: ativo, p_motivo: motivo.trim() })).error);
  },
  /** Inativa ou reativa uma unidade da permuta (motivo obrigatório). */
  async definirStatusUnidade(id: string, ativo: boolean, motivo: string): Promise<void> {
    erro((await sb().rpc('app_permuta_unidade_status', { p_id: id, p_ativo: ativo, p_motivo: motivo.trim() })).error);
  },
  async historico(permutaId: string): Promise<HistoricoItem[]> {
    const { data, error } = await sb().rpc('app_permutas_historico', { p_permuta: permutaId });
    erro(error);
    return (data || []) as HistoricoItem[];
  },

  /**
   * Grava a permuta, troca as unidades pelas da lista, sobe os anexos novos e apaga os removidos.
   * Devolve o id (novo ou o mesmo).
   */
  async salvar(id: string | null, dados: PermutaDados, unidades: PermutaUnidade[], novos: AnexoNovo[], removidos: PermutaAnexo[]): Promise<string> {
    const pid = id || uuid();
    if (id) erro((await sb().from('app_permutas').update(dados).eq('id', id)).error);
    else erro((await sb().from('app_permutas').insert({ id: pid, ...dados })).error);

    // Unidades: apaga as que saíram e grava a lista atual (unique permuta_id + unidade_id).
    const manter = unidades.map(u => u.unidade_id);
    let del = sb().from('app_permuta_unidades').delete().eq('permuta_id', pid);
    if (manter.length) del = del.not('unidade_id', 'in', `(${manter.join(',')})`);
    erro((await del).error);
    if (unidades.length) {
      const linhas = unidades.map((u, i) => ({
        permuta_id: pid, enterprise_id: u.enterprise_id, unidade_id: u.unidade_id, unidade_nome: u.unidade_nome,
        area_privativa: u.area_privativa, valor_unidade: u.valor_unidade, ordem: i,
      }));
      erro((await sb().from('app_permuta_unidades').upsert(linhas, { onConflict: 'permuta_id,unidade_id' })).error);
    }

    // Anexos removidos: linha e arquivo.
    if (removidos.length) {
      erro((await sb().from('app_permuta_anexos').delete().in('id', removidos.map(a => a.id))).error);
      await sb().storage.from(BUCKET).remove(removidos.map(a => a.storage_path));
    }
    // Anexos novos: arquivo primeiro; se a linha falhar, o arquivo sai.
    for (const a of novos) {
      const aid = uuid();
      const path = `${pid}/${aid}-${nomeArquivo(a.file.name)}`;
      const up = await sb().storage.from(BUCKET).upload(path, a.file, { contentType: a.file.type || 'application/octet-stream' });
      if (up.error) throw new Error(`${a.file.name}: ${up.error.message}`);
      const { error } = await sb().from('app_permuta_anexos').insert({
        id: aid, permuta_id: pid, tipo: a.tipo, descricao: a.tipo === 'Outro' ? a.descricao.trim() : null,
        nome: a.file.name, mime: a.file.type || '', tamanho: a.file.size, storage_path: path,
      });
      if (error) { await sb().storage.from(BUCKET).remove([path]); erro(error); }
    }
    return pid;
  },

  async excluir(p: Permuta): Promise<void> {
    erro((await sb().from('app_permutas').delete().eq('id', p.id)).error);
    if (p.anexos.length) await sb().storage.from(BUCKET).remove(p.anexos.map(a => a.storage_path));
  },

  /** Lê o contrato com IA e devolve a sugestão de preenchimento. Nada é gravado. */
  async lerContrato(file: File): Promise<ImportacaoContrato> {
    const pdfBase64 = await paraBase64(file);
    const { data, error } = await sb().functions.invoke('app-permutas', { body: { acao: 'ler_contrato', pdfBase64, nomeArquivo: file.name } });
    if (error) {
      const b = await (error as any).context?.json?.().catch(() => null);
      throw new Error(b?.error || error.message);
    }
    return data as ImportacaoContrato;
  },
  /** Usuários ativos (nome, e-mail, departamento) para sugerir como destinatários. */
  async destinatarios(): Promise<Destinatario[]> {
    const { data, error } = await sb().from('app_usuarios').select('nome, email, departamento').eq('status', 'ativo').order('nome');
    erro(error);
    return (data || []) as Destinatario[];
  },
  /** Envia os dados da permuta por e-mail; a função monta o corpo e confere a permissão de edição. */
  async notificar(permutaId: string, para: string[], opcoes: { novo: boolean; anexar: boolean }): Promise<void> {
    const { error } = await sb().functions.invoke('app-email', { body: { tipo: 'permuta', permuta_id: permutaId, para, ...opcoes } });
    if (!error) return;
    const ctx = (error as any).context;
    if (ctx?.status === 503) throw new Error('O envio de e-mail ainda não foi configurado no servidor.');
    const b = await ctx?.json?.().catch(() => null);
    throw new Error(b?.error || error.message);
  },
  /** Preços da tabela de vendas no mês do contrato (unidades sem preço não voltam). */
  async precos(itens: { enterprise_id: number; unidade: string }[], data: string | null): Promise<PrecoUnidade[]> {
    if (!itens.length) return [];
    const { data: linhas, error } = await sb().rpc('app_permutas_precos', {
      p_enterprise: itens.map(i => i.enterprise_id), p_unidade: itens.map(i => i.unidade), p_data: data,
    });
    erro(error);
    return ((linhas || []) as any[]).map(l => ({ ...l, preco: Number(l.preco) }));
  },

  /** Link temporário (2 min) para baixar o anexo. */
  async link(a: PermutaAnexo): Promise<string> {
    const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(a.storage_path, 120, { download: a.nome });
    erro(error);
    return data!.signedUrl;
  },
};
