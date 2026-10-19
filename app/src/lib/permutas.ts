// Permutas › Cadastro: dados e regras de cálculo (migration 20261016100000_app_permutas.sql).
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
}
export interface PermutaAnexo {
  id: string; tipo: TipoAnexo; descricao: string | null; nome: string; mime: string;
  tamanho: number; storage_path: string; adicionado_em: string;
}
export interface Permuta {
  id: string;
  empresa_id: number | null; negocio_id: string | null;
  permutante: string; num_matricula: string | null;
  area_matricula: number | null; coeficiente: number | null;
  /** Fração: 0,12 = 12%. */
  pct_permuta: number | null;
  area_propria: number | null; area_informada: number | null;
  observacao: string | null; pendencia: string | null;
  data_contrato?: string | null;
  unidades: PermutaUnidade[];
  anexos: PermutaAnexo[];
}
export type PermutaDados = Omit<Permuta, 'id' | 'unidades' | 'anexos'>;
/** Arquivo escolhido na modal, enviado ao salvar. */
export interface AnexoNovo { file: File; tipo: TipoAnexo | ''; descricao: string }

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
  if (e.code === '23505') throw new Error('Já existe um negócio com esse nome.');
  throw new Error(e.message);
}
const nomeArquivo = (s: string) =>
  (s || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-100);
const uuid = () => (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

const SEL = 'id, empresa_id, negocio_id, permutante, num_matricula, area_matricula, coeficiente, pct_permuta, area_propria, area_informada, observacao, pendencia, data_contrato, '
  + 'unidades:app_permuta_unidades(id, enterprise_id, unidade_id, unidade_nome, area_privativa, valor_unidade, ordem), '
  + 'anexos:app_permuta_anexos(id, tipo, descricao, nome, mime, tamanho, storage_path, adicionado_em)';
const FICHA = 'id, enterprise_id, nome, tipo, tipo_permuta, status, alerta, acao';
const numOuNull = (v: any) => (v == null ? null : Number(v));
function normaliza(r: any): Permuta {
  return {
    ...r,
    area_matricula: numOuNull(r.area_matricula), coeficiente: numOuNull(r.coeficiente), pct_permuta: numOuNull(r.pct_permuta),
    area_propria: numOuNull(r.area_propria), area_informada: numOuNull(r.area_informada),
    unidades: (r.unidades || []).map((u: any) => ({ ...u, area_privativa: numOuNull(u.area_privativa), valor_unidade: numOuNull(u.valor_unidade) }))
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

  async criarNegocio(nome: string): Promise<Negocio> {
    const { data, error } = await sb().from('negocios_permuta').insert({ nome: nome.trim() }).select('id, nome').single();
    erro(error);
    return data as Negocio;
  },
  async renomearNegocio(id: string, nome: string): Promise<void> {
    const { error } = await sb().from('negocios_permuta').update({ nome: nome.trim() }).eq('id', id);
    erro(error);
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

  /** Link temporário (2 min) para baixar o anexo. */
  async link(a: PermutaAnexo): Promise<string> {
    const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(a.storage_path, 120, { download: a.nome });
    erro(error);
    return data!.signedUrl;
  },
};
