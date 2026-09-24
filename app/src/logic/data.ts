import type { AppLogic } from './AppLogic';
import {
  api, cadastrosApi, empresaLabel, todayIso, addDays,
  type Empresa, type FluxoDia, type TituloPagar, type PagarSegmento, type PagoDia, type SaldoConta, type Lancamento, type LancamentoNovo,
} from '../lib/api';

// Live-data layer for the screens. In demo mode (no Supabase env) none of this runs
// and the screens keep the prototype's sample data.

export type RangeKind = 'fluxo' | 'pagar' | 'seg' | 'pagos' | 'saldo';
export interface RangeEntry<T> {
  status: 'loading' | 'ready' | 'error';
  rows: T[];
  error?: string;
}

// Before the app_saldo_contas_manual / app_rec_financeiro_lancamento tables existed these
// lived in localStorage; migrateLocalData() uploads them once and clears the keys.
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
    await Promise.all([this.loadUsuarios(), this.loadCadastros(), this.loadLanc(), this.loadFxSemRec()]);
    await migrateLocalData(this);
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
        : kind === 'pagos' ? await api.pagosDiario(from, to)
          : kind === 'saldo' ? await cadastrosApi.saldos(from)
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
  const saldo = (d: string) => out.push(['saldo', d, d]);
  if (s.page === 'saldos') saldo(s.sbDate || today);
  if (s.page === 'programacao') { out.push(['pagar', s.pgDateFrom || today, s.pgDateTo || today]); saldo(s.pgDateFrom || today); }
  if (s.page === 'fluxo') { out.push(['fluxo', today, addDays(today, FLUXO_DAYS - 1)]); saldo(today); }
  const pages = ['usuarios', 'departamentos', 'perfis', 'saldos', 'lancamentos', 'programacao', 'fluxo'];
  if (!pages.includes(s.page)) {
    out.push(['fluxo', addDays(today, -DASH_BACK_DAYS), addDays(today, DASH_AHEAD_DAYS)]);
    out.push(['pagar', today, addDays(today, DASH_AHEAD_DAYS)]);
    out.push(['seg', dashPeriodStart(s.period), today]);
    out.push(['pagos', addDays(today, -DASH_BACK_DAYS), today]);
    saldo(today);
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

// ---------- saldos informados (app_saldo_contas_manual) ----------
export interface SaldoInformado { saldo: number; upd: string; origem?: string; obs?: string }

const stamp = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Informed balances per date (only the dates already loaded by ensureRanges). */
export function readSaldos(this: AppLogic): Record<string, Record<string, SaldoInformado>> {
  const ranges = this.state.dbRanges || {};
  if (this._saldoSrc === ranges) return this._saldoMap;
  const out: Record<string, Record<string, SaldoInformado>> = {};
  for (const [key, entry] of Object.entries<any>(ranges)) {
    if (!key.startsWith('saldo:')) continue;
    const date = key.split(':')[1];
    out[date] = Object.fromEntries((entry.rows as SaldoConta[]).map(r => [r.conta_id, {
      saldo: Number(r.saldo), upd: stamp(r.atualizado_em), origem: r.origem, obs: r.obs || '',
    }]));
  }
  this._saldoSrc = ranges;
  this._saldoMap = out;
  return out;
}

function saldoRow(date: string, contaId: string, v: SaldoInformado): SaldoConta {
  const [cd, bank, ag, acc] = contaId.split('|');
  const origem = (['Manual', 'Extrato bancário', 'Planilha'] as const).find(o => o === v.origem) || 'Manual';
  return {
    data: date, company_id: Number(cd), conta_id: contaId, bank_number: bank || null, agency_number: ag || null,
    account_number: acc || null, saldo: Math.round(v.saldo * 100) / 100, origem, obs: v.obs || null,
  };
}

/** Saves balances for a date and reloads that date. Resolves false (after a toast) on error. */
export async function writeSaldos(this: AppLogic, date: string, patch: Record<string, SaldoInformado>): Promise<boolean> {
  try {
    await cadastrosApi.salvarSaldos(Object.entries(patch).map(([id, v]) => saldoRow(date, id, v)));
  } catch (e: any) {
    this.toast('Não foi possível salvar o saldo: ' + e.message);
    return false;
  }
  await fetchRange(this, 'saldo', date, date);
  return true;
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

// ---------- lançamentos manuais (app_rec_financeiro_lancamento) ----------
/** Row in the shape the prototype's screens use. */
export function lancToRow(this: AppLogic, l: Lancamento) {
  return {
    id: l.id, date: l.data, cd: l.company_id, emp: this.empresaNome(l.company_id), desc: l.descricao, cat: l.categoria,
    tipo: l.tipo, value: Number(l.valor), rec: l.recorrencia, parc: l.parcela, parcTotal: l.total_parcelas, grupo: l.grupo_id,
    sit: l.situacao,
  };
}

/** Loads every manual entry (they are few) into state.lcRowsData. */
export async function loadLanc(this: AppLogic) {
  try {
    const rows = await cadastrosApi.lancamentos('1900-01-01', '2999-12-31');
    this.setState({ lcDb: rows, lcRowsData: rows.map(r => lancToRow.call(this, r)) });
  } catch (e: any) {
    this.toast('Não foi possível carregar os lançamentos manuais: ' + e.message);
  }
}

/** Empresas whose parcelas a receber the Fluxo de caixa ignores (state.fxSemRec). */
export async function loadFxSemRec(this: AppLogic) {
  try {
    const rows = await cadastrosApi.fluxoSemReceber();
    this.setState({ fxSemRec: rows.map(r => ({ cd: r.company_id, motivo: r.motivo })) });
  } catch (e: any) {
    this.setState({ fxSemRec: [] });
    this.toast('Não foi possível carregar as empresas sem recebíveis do fluxo: ' + e.message);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Date of installment i (0-based): monthly keeps the day (clamped to month end), weekly adds 7 days. */
export function parcelaDate(base: string, rec: string, i: number): string {
  if (rec === 'Semanal') return addDays(base, 7 * i);
  if (rec !== 'Mensal' || i === 0) return base;
  const [y, m, d] = base.split('-').map(Number);
  const t = new Date(y, m - 1 + i, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(Math.min(d, last))}`;
}

/** One row per installment ("Mensal · 6x" → 6 rows with the same grupo_id). */
export function expandLanc(base: Omit<LancamentoNovo, 'parcela' | 'total_parcelas' | 'grupo_id'>, total: number, from = 1, grupo?: string): LancamentoNovo[] {
  const n = base.recorrencia === 'Nenhuma' ? 1 : Math.max(1, Math.min(120, Math.floor(total) || 1));
  const grupo_id = n > 1 ? (grupo || crypto.randomUUID()) : null;
  const out: LancamentoNovo[] = [];
  for (let p = from; p <= n; p++) {
    out.push({ ...base, data: parcelaDate(base.data, base.recorrencia, p - 1), parcela: p, total_parcelas: n, grupo_id, recorrencia: n > 1 ? base.recorrencia : 'Nenhuma' });
  }
  return out;
}

/** Uploads balances/entries saved in this browser before the tables existed, then clears them. */
async function migrateLocalData(app: AppLogic) {
  let saldos: Record<string, Record<string, SaldoInformado>> = {};
  let lancs: any[] = [];
  try { saldos = JSON.parse(localStorage.getItem(LS_SALDOS) || '{}'); } catch { /* ignore */ }
  try { lancs = JSON.parse(localStorage.getItem(LS_LANC) || '[]'); } catch { /* ignore */ }
  const rows = Object.entries(saldos).flatMap(([date, day]) => Object.entries(day || {}).map(([id, v]) => saldoRow(date, id, v)));
  let moved = 0;
  if (rows.length && app.pode('financeiro.saldos', true)) {
    try { await cadastrosApi.salvarSaldos(rows); localStorage.removeItem(LS_SALDOS); moved += rows.length; } catch { /* keep for next time */ }
  }
  const novos = (Array.isArray(lancs) ? lancs : []).filter(l => l && l.cd && l.date && l.value > 0).flatMap(l => expandLanc({
    data: l.date, company_id: Number(l.cd), descricao: String(l.desc || 'Lançamento'), categoria: String(l.cat || 'Outros'),
    tipo: l.tipo === 'entrada' ? 'entrada' : 'saida', valor: Number(l.value), recorrencia: ['Mensal', 'Semanal'].includes(l.rec) ? l.rec : 'Nenhuma',
    situacao: l.sit === 'lancado' ? 'lancado' : 'previsto',
  }, Number(l.parc) || 1));
  if (novos.length && app.pode('financeiro.lancamentos', true)) {
    try { await cadastrosApi.inserirLancamentos(novos); localStorage.removeItem(LS_LANC); moved += novos.length; await app.loadLanc(); } catch { /* keep */ }
  } else if (!novos.length) localStorage.removeItem(LS_LANC);
  if (moved) {
    app.setState({ dbRanges: Object.fromEntries(Object.entries(app.state.dbRanges || {}).filter(([k]) => !k.startsWith('saldo:'))) });
    app.toast(`Dados que estavam salvos só neste navegador foram enviados ao banco (${moved} registros).`);
  }
}

// ---------- helpers shared by screens ----------
export function sumBy<T>(rows: T[], f: (r: T) => number) {
  let t = 0;
  for (const r of rows) t += f(r) || 0;
  return t;
}

export type { FluxoDia, TituloPagar, PagarSegmento, PagoDia };
