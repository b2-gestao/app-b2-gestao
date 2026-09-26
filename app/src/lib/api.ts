import { supabase } from './supabase';

// Typed wrappers for the RPCs in supabase/migrations/*_app_rpc_financeiro.sql.
// Every RPC returns a single jsonb value so PostgREST's 1000-row cap never applies.

export interface Empresa {
  id: number;
  nome: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  /** Empreendimento names from de_para_sharepoint (LEFT JOIN — may be null). */
  empreendimentos: string | null;
}

export interface CentroCusto {
  id: number;
  nome: string;
  id_empresa: number | null;
}

export interface ContaCorrente {
  company_id: number;
  company_name: string;
  bank_number: string | null;
  bank_name: string | null;
  agency_number: string | null;
  account_number: string | null;
  account_name: string | null;
  account_type: string | null;
}

export interface TituloPagar {
  bill_id: number;
  installment_id: number;
  company_id: number;
  company_name: string;
  due_date: string;
  creditor_name: string | null;
  document_id: string | null;
  document_number: string | null;
  business_area: string | null;
  balance: number;
  authorized: boolean;
}

export interface FluxoDia {
  company_id: number;
  dia: string;
  receber_aberto: number;
  receber_original: number;
  pagar_aberto: number;
  pagar_original: number;
  pagar_quitado: number;
  pagar_desconto: number;
  pagar_correcao: number;
}

/** Parcelas a receber em aberto no período por empresa, sem Bens, Permuta e Financiamento. */
export interface ReceberEmpresa {
  company_id: number;
  receber_aberto: number;
  parcelas: number;
}

export interface PagoDia {
  company_id: number;
  dia: string;
  pago: number;
  /** juros + multa */
  juros: number;
  correcao: number;
  desconto: number;
}

export interface PagarSegmento {
  company_id: number;
  segmento: string;
  total: number;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  empresas: () => rpc<Empresa[]>('app_empresas'),
  centrosCusto: () => rpc<CentroCusto[]>('app_centros_custo'),
  contasCorrentes: () => rpc<ContaCorrente[]>('app_contas_correntes'),
  pagarPeriodo: (de: string, ate: string, empresas?: number[] | null) =>
    rpc<TituloPagar[]>('app_pagar_periodo', { p_de: de, p_ate: ate, p_empresas: empresas && empresas.length ? empresas : null }),
  fluxoDiario: (de: string, ate: string, empresas?: number[] | null) =>
    rpc<FluxoDia[]>('app_fluxo_diario', { p_de: de, p_ate: ate, p_empresas: empresas && empresas.length ? empresas : null }),
  receberPeriodo: (de: string, ate: string, empresas?: number[] | null) =>
    rpc<ReceberEmpresa[]>('app_receber_periodo', { p_de: de, p_ate: ate, p_empresas: empresas && empresas.length ? empresas : null }),
  pagarSegmentos: (de: string, ate: string) => rpc<PagarSegmento[]>('app_pagar_segmentos', { p_de: de, p_ate: ate }),
  ultimoSync: () => rpc<string | null>('app_ultimo_sync'),
  pagosDiario: (de: string, ate: string) => rpc<PagoDia[]>('app_pagos_diario', { p_de: de, p_ate: ate }),
};

/** Display name used across the app: "Nome fantasia – Empreendimento(s)". */
export function empresaLabel(e: Empresa): string {
  const base = (e.nome_fantasia || e.nome || '').trim();
  return e.empreendimentos ? `${base} – ${e.empreendimentos}` : base;
}

// ---- dates (local time, ISO yyyy-mm-dd) ----
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function todayIso(): string {
  return isoDate(new Date());
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

// ---- usuários (tabela app_usuarios + edge function app-usuarios) ----
export interface UsuarioApp {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  funcao: string;
  departamento: string | null;
  empresas: number[];
  centros_custo: number[];
  status: 'ativo' | 'inativo' | 'pendente';
}

export const usuariosApi = {
  listar: async (): Promise<UsuarioApp[]> => {
    if (!supabase) throw new Error('Supabase não configurado');
    const { data, error } = await supabase.from('app_usuarios').select('*').order('nome');
    if (error) throw new Error(error.message);
    return data as UsuarioApp[];
  },
  souMembro: () => rpc<boolean>('app_is_member'),
  souAdmin: () => rpc<boolean>('app_is_admin'),
  /** Calls the app-usuarios edge function (see supabase/functions/app-usuarios). */
  acao: async <T = any>(acao: string, payload: Record<string, unknown>): Promise<T> => {
    if (!supabase) throw new Error('Supabase não configurado');
    const { data, error } = await supabase.functions.invoke('app-usuarios', { body: { acao, ...payload } });
    if (error) {
      // FunctionsHttpError carries the JSON body with our message.
      const body = await (error as any).context?.json?.().catch(() => null);
      throw new Error(body?.error || error.message);
    }
    return data as T;
  },
};

// ---- tabelas do app (RLS: leitura para membros, escrita conforme o perfil) ----
function db() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}
/** Postgres/PostgREST errors in the words the screens show. */
function msg(error: { message: string; code?: string; details?: string }): Error {
  if (error.code === '42501') return new Error('Seu perfil não tem permissão para esta alteração.');
  if (error.code === '23505') return new Error('Já existe um cadastro com esse nome.');
  if (error.code === '23503' && /app_rec_financeiro_lancamento/.test(error.details || '')) {
    return new Error('Não é possível excluir: há lançamentos com esta categoria. Inative-a para tirá-la do formulário.');
  }
  if (error.code === '23503' && /app_lancamento_categorias/.test(error.details || '')) {
    return new Error('Categoria não cadastrada. Cadastre-a em Cadastros › Financeiro › Categorias.');
  }
  if (error.code === '23503') return new Error('Não é possível excluir: há usuários vinculados a este cadastro.');
  return new Error(error.message);
}
async function run<T>(q: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw msg(error);
  return data as T;
}

export interface Perfil {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  permissoes: Record<string, { view: boolean; edit: boolean }>;
  sistema: boolean;
}
export interface Departamento { id: string; nome: string; descricao: string | null; ativo: boolean }
export interface Categoria { id: string; nome: string; descricao: string | null; ativo: boolean }
export interface SaldoConta {
  data: string;
  company_id: number;
  conta_id: string;
  bank_number: string | null;
  agency_number: string | null;
  account_number: string | null;
  saldo: number;
  origem: 'Manual' | 'Extrato bancário' | 'Planilha';
  obs: string | null;
  atualizado_em?: string;
}
export interface ContaSelecionada {
  conta_id: string;
  company_id: number;
  bank_number: string | null;
  agency_number: string | null;
  account_number: string | null;
}
export interface Lancamento {
  id: string;
  data: string;
  company_id: number;
  descricao: string;
  categoria: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  recorrencia: 'Nenhuma' | 'Mensal' | 'Semanal';
  parcela: number;
  total_parcelas: number;
  grupo_id: string | null;
  situacao: 'lancado' | 'previsto';
}
export type LancamentoNovo = Omit<Lancamento, 'id'>;
/** Empresa whose parcelas a receber are left out of the Fluxo de caixa (already committed). */
export interface EmpresaSemReceber { company_id: number; motivo: string }

/** Power BI report published to the web (app_bi_paineis). */
export interface BiPainel { id: string; nome: string; url: string; ordem: number; ativo: boolean; ocultar_rodape: boolean }

export const cadastrosApi = {
  perfis: () => run<Perfil[]>(db().from('app_perfis').select('id, nome, descricao, ativo, permissoes, sistema').order('nome')),
  salvarPerfil: (id: string | null, p: Omit<Perfil, 'id' | 'sistema'>) =>
    run(id ? db().from('app_perfis').update(p).eq('id', id) : db().from('app_perfis').insert(p)),
  excluirPerfil: (id: string) => run(db().from('app_perfis').delete().eq('id', id)),

  departamentos: () => run<Departamento[]>(db().from('app_departamentos').select('id, nome, descricao, ativo').order('nome')),
  salvarDepartamento: (id: string | null, d: Omit<Departamento, 'id'>) =>
    run(id ? db().from('app_departamentos').update(d).eq('id', id) : db().from('app_departamentos').insert(d)),
  excluirDepartamento: (id: string) => run(db().from('app_departamentos').delete().eq('id', id)),

  categorias: () => run<Categoria[]>(db().from('app_lancamento_categorias').select('id, nome, descricao, ativo').order('nome')),
  salvarCategoria: (id: string | null, c: Omit<Categoria, 'id'>) =>
    run(id ? db().from('app_lancamento_categorias').update(c).eq('id', id) : db().from('app_lancamento_categorias').insert(c)),
  excluirCategoria: (id: string) => run(db().from('app_lancamento_categorias').delete().eq('id', id)),

  saldos: (data: string) => run<SaldoConta[]>(db().from('app_saldo_contas_manual')
    .select('data, company_id, conta_id, bank_number, agency_number, account_number, saldo, origem, obs, atualizado_em').eq('data', data)),
  salvarSaldos: (rows: SaldoConta[]) => run(db().from('app_saldo_contas_manual').upsert(rows, { onConflict: 'data,conta_id' })),

  /** Contas que aparecem na tela Saldos bancários (só as adicionadas). */
  contasSelecionadas: () => run<{ conta_id: string }[]>(db().from('app_saldo_contas_selecionadas').select('conta_id')),
  adicionarContaSelecionada: (c: ContaSelecionada | ContaSelecionada[]) =>
    run(db().from('app_saldo_contas_selecionadas').upsert(c, { onConflict: 'conta_id', ignoreDuplicates: true })),
  removerContaSelecionada: (contaId: string) => run(db().from('app_saldo_contas_selecionadas').delete().eq('conta_id', contaId)),

  lancamentos: (de: string, ate: string) => run<Lancamento[]>(db().from('app_rec_financeiro_lancamento')
    .select('id, data, company_id, descricao, categoria, tipo, valor, recorrencia, parcela, total_parcelas, grupo_id, situacao')
    .gte('data', de).lte('data', ate).order('data').limit(5000)),
  inserirLancamentos: (rows: LancamentoNovo[]) => run(db().from('app_rec_financeiro_lancamento').insert(rows)),
  atualizarLancamento: (id: string, patch: Partial<LancamentoNovo>) => run(db().from('app_rec_financeiro_lancamento').update(patch).eq('id', id)),
  excluirLancamento: (id: string) => run(db().from('app_rec_financeiro_lancamento').delete().eq('id', id)),

  fluxoSemReceber: () => run<EmpresaSemReceber[]>(db().from('app_fluxo_empresas_sem_receber').select('company_id, motivo').order('company_id')),
  /** Replaces the list: upserts `rows`, deletes the companies in `remover`. */
  salvarFluxoSemReceber: async (rows: EmpresaSemReceber[], remover: number[]) => {
    if (remover.length) await run(db().from('app_fluxo_empresas_sem_receber').delete().in('company_id', remover));
    if (rows.length) await run(db().from('app_fluxo_empresas_sem_receber').upsert(rows, { onConflict: 'company_id' }));
  },

  /** Painéis the profile can see (RLS: bi.<id> to view, bi.gerenciar sees all). */
  biPaineis: () => run<BiPainel[]>(db().from('app_bi_paineis').select('id, nome, url, ordem, ativo, ocultar_rodape').order('ordem').order('nome')),
  /** Replaces the list: updates rows with id, inserts rows without, deletes the ids in `remover`. */
  salvarBiPaineis: async (rows: (Omit<BiPainel, 'id'> & { id?: string })[], remover: string[]) => {
    if (remover.length) await run(db().from('app_bi_paineis').delete().in('id', remover));
    const antigos = rows.filter(r => r.id);
    const novos = rows.filter(r => !r.id).map(({ id: _id, ...r }) => r);
    if (antigos.length) await run(db().from('app_bi_paineis').upsert(antigos, { onConflict: 'id' }));
    if (novos.length) await run(db().from('app_bi_paineis').insert(novos));
  },
};

// ---- edge functions de apoio ----
export async function invoke<T>(fn: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(fn, { body: body || {} });
  if (error) {
    const b = await (error as any).context?.json?.().catch(() => null);
    const e: any = new Error(b?.error || error.message);
    e.status = (error as any).context?.status;
    throw e;
  }
  return data as T;
}

export interface IaResposta { headline: string; items: { label: string; text: string; nivel: 'critico' | 'atencao' | 'info' | 'positivo' }[]; modelo: string; cache?: boolean; gerado_em?: string }

export const apoioApi = {
  /** BCB/SGS via edge function app-indicadores: { SELIC: { valor, data } | null, ... } */
  indicadores: () => invoke<{ indicadores: Record<string, { valor: number; data: string } | null> }>('app-indicadores'),
  /** Análise com IA (edge function app-ia). 503 = IA não configurada. */
  ia: (tela: 'prog' | 'fluxo', contexto: unknown, regras: { label: string; text: string }[]) =>
    invoke<IaResposta>('app-ia', { tela, contexto, regras }),
  /** Só o id do modelo configurado em IA_MODEL. */
  iaModelo: () => invoke<{ modelo: string }>('app-ia', { tela: 'modelo' }),
};
