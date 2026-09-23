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
  pagarSegmentos: (de: string, ate: string) => rpc<PagarSegmento[]>('app_pagar_segmentos', { p_de: de, p_ate: ate }),
  ultimoSync: () => rpc<string | null>('app_ultimo_sync'),
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
