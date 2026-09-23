import type { AppLogic } from './AppLogic';
import { api, empresaLabel, todayIso, addDays, type Empresa, type FluxoDia, type TituloPagar, type PagarSegmento } from '../lib/api';

// Live-data layer for the screens. In demo mode (no Supabase env) none of this runs
// and the screens keep the prototype's sample data.

export type RangeKind = 'fluxo' | 'pagar' | 'seg';
export interface RangeEntry<T> {
  status: 'loading' | 'ready' | 'error';
  rows: T[];
  error?: string;
}

const LS_SALDOS = 'b2_saldos_informados_v1';
const LS_LANC = 'b2_lancamentos_manuais_v1';

// Dashboard windows: chart history (90 days) plus the next 30 days of payables.
export const DASH_BACK_DAYS = 89;
export const DASH_AHEAD_DAYS = 30;
export const FLUXO_DAYS = 10;

export async function loadCatalogs(this: AppLogic) {
  try {
    const [empresas, centros, contas, sync] = await Promise.all([
      api.empresas(), api.centrosCusto(), api.contasCorrentes(), api.ultimoSync().catch(() => null),
    ]);
    this.setState({ dbEmpresas: empresas, dbCentros: centros, dbContas: contas, dbSync: sync, dbError: '' });
    this.loadUsuarios();
  } catch (e: any) {
    this.setState({ dbError: e.message || String(e) });
    this.toast('Não foi possível carregar os dados do Supabase: ' + (e.message || e));
  }
}

function rangeKey(kind: RangeKind, from: string, to: string) {
  return `${kind}:${from}:${to}`;
}

/** Cached range data; returns undefined until requested via ensureRanges(). */
export function rangeData<T>(this: AppLogic, kind: RangeKind, from: string, to: string): RangeEntry<T> | undefined {
  return (this.state.dbRanges || {})[rangeKey(kind, from, to)];
}

async function fetchRange(app: AppLogic, kind: RangeKind, from: string, to: string) {
  const key = rangeKey(kind, from, to);
  if (app._inflight?.[key]) return;
  app._inflight = { ...(app._inflight || {}), [key]: true };
  const put = (entry: RangeEntry<unknown>) => app.setState((st: any) => ({ dbRanges: { ...(st.dbRanges || {}), [key]: entry } }));
  put({ status: 'loading', rows: rangeData.call(app, kind, from, to)?.rows || [] });
  try {
    const rows: unknown[] = kind === 'fluxo' ? await api.fluxoDiario(from, to)
      : kind === 'pagar' ? await api.pagarPeriodo(from, to)
        : await api.pagarSegmentos(from, to);
    put({ status: 'ready', rows });
  } catch (e: any) {
    put({ status: 'error', rows: [], error: e.message || String(e) });
    app.toast('Erro ao consultar o Supabase: ' + (e.message || e));
  } finally {
    delete app._inflight[key];
  }
}

/** Ranges each screen needs for the current state. */
export function neededRanges(this: AppLogic): [RangeKind, string, string][] {
  const s = this.state;
  const today = todayIso();
  const out: [RangeKind, string, string][] = [];
  if (s.view !== 'app') return out;
  if (s.page === 'programacao') out.push(['pagar', s.pgDateFrom || today, s.pgDateTo || today]);
  if (s.page === 'fluxo') out.push(['fluxo', today, addDays(today, FLUXO_DAYS - 1)]);
  const pages = ['usuarios', 'departamentos', 'perfis', 'saldos', 'lancamentos', 'programacao', 'fluxo'];
  if (!pages.includes(s.page)) {
    out.push(['fluxo', addDays(today, -DASH_BACK_DAYS), addDays(today, DASH_AHEAD_DAYS)]);
    out.push(['pagar', today, addDays(today, DASH_AHEAD_DAYS)]);
    out.push(['seg', dashPeriodStart(s.period), today]);
  }
  return out;
}

export function ensureRanges(this: AppLogic) {
  if (!this.live || !this.props.session) return;
  for (const [kind, from, to] of this.neededRanges()) {
    const cur = this.rangeData(kind, from, to);
    if (!cur || (cur.status === 'error' && !this._retried?.[rangeKey(kind, from, to)])) {
      if (cur?.status === 'error') this._retried = { ...(this._retried || {}), [rangeKey(kind, from, to)]: true };
      fetchRange(this, kind, from, to);
    }
  }
}

export function dashPeriodStart(period: string): string {
  const today = todayIso();
  if (period === 'D') return today;
  if (period === '30D') return addDays(today, -34);
  if (period === '90D') return addDays(today, -89);
  return addDays(today, -6);
}

// ---------- empresas ----------
export function empresaById(this: AppLogic): Record<number, Empresa & { label: string }> {
  const list: Empresa[] = this.state.dbEmpresas || [];
  if (this._empMapSrc !== list) {
    this._empMapSrc = list;
    this._empMap = Object.fromEntries(list.map(e => [e.id, { ...e, label: empresaLabel(e) }]));
  }
  return this._empMap;
}

export function empresaNome(this: AppLogic, id: number, fallback?: string): string {
  const e = this.empresaById()[id];
  return e ? e.label : (fallback || `Empresa ${id}`);
}

// ---------- saldos informados (local until a table exists) ----------
export interface SaldoInformado { saldo: number; upd: string; origem?: string; obs?: string }

export function readSaldos(this: AppLogic): Record<string, Record<string, SaldoInformado>> {
  if (this.state.saldosInformados) return this.state.saldosInformados;
  try { return JSON.parse(localStorage.getItem(LS_SALDOS) || '{}'); } catch { return {}; }
}

export function writeSaldos(this: AppLogic, date: string, patch: Record<string, SaldoInformado>) {
  const all = { ...this.readSaldos() };
  all[date] = { ...(all[date] || {}), ...patch };
  try { localStorage.setItem(LS_SALDOS, JSON.stringify(all)); } catch { /* storage full or blocked */ }
  this.setState({ saldosInformados: all });
}

/** Informed opening balance per company for a date. */
export function saldoPorEmpresa(this: AppLogic, date: string): Record<number, number> {
  const day: Record<string, SaldoInformado> = this.readSaldos()[date] || {};
  const out: Record<number, number> = {};
  for (const [id, v] of Object.entries(day)) {
    const cd = Number(id.split('|')[0]);
    out[cd] = (out[cd] || 0) + (v.saldo || 0);
  }
  return out;
}

// ---------- lançamentos manuais (local until a table exists) ----------
export function readLanc(this: AppLogic): any[] {
  try { return JSON.parse(localStorage.getItem(LS_LANC) || '[]'); } catch { return []; }
}
export function writeLanc(this: AppLogic, rows: any[]) {
  try { localStorage.setItem(LS_LANC, JSON.stringify(rows)); } catch { /* ignore */ }
}

// ---------- helpers shared by screens ----------
export function sumBy<T>(rows: T[], f: (r: T) => number) {
  let t = 0;
  for (const r of rows) t += f(r) || 0;
  return t;
}

export type { FluxoDia, TituloPagar, PagarSegmento };
