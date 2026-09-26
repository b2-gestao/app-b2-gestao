import type { AppLogic } from '../AppLogic';
import { todayIso, addDays } from '../../lib/api';
import { FLUXO_DAYS, type FluxoDia } from '../data';

const DOWS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Company that funds the SPEs ("Holding · origem dos aportes"). The prototype used
 * Sienge company 2; override with VITE_HOLDING_EMPRESA_ID.
 */
export const HOLDING_ID = Number(import.meta.env.VITE_HOLDING_EMPRESA_ID || 2);

/** Longest period the Fluxo de caixa shows (one column per day). */
export const FLUXO_MAX_DAYS = 62;

/**
 * Period chosen on the screen (state.fxDateFrom / fxDateTo; default today + 9 days).
 * `anchor` is where the calculation starts: bank balances are only informed up to
 * today, so a period starting later is projected from today and shown from `from` on.
 */
export function fluxoPeriodo(s: any) {
  const today = todayIso();
  const from: string = s.fxDateFrom || today;
  let to: string = s.fxDateTo || addDays(from, FLUXO_DAYS - 1);
  if (to < from) to = from;
  if (to > addDays(from, FLUXO_MAX_DAYS - 1)) to = addDays(from, FLUXO_MAX_DAYS - 1);
  return { from, to, anchor: from > today ? today : from };
}

export const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/** The holding is linked to every SPE's empreendimento in De Para; show only its own name. */
const holdingNome = (e: any, fallback: string) => (e && (e.nome_fantasia || e.nome || '').trim()) || fallback;

/**
 * Fluxo de caixa (live), one column per day of the chosen period, per company:
 *   caixa inicial  = opening balance typed in Saldos bancários on the anchor day (rolled
 *                    forward to the first day shown when the period starts after today)
 *   receitas       = receber_caixa (corrected balance, D+2, see app_fluxo_diario), zero for
 *                    the companies in app_fluxo_empresas_sem_receber (state.fxSemRec) and on
 *                    the anchor day: its bank balance already includes what came in that day,
 *                    so counting those parcelas again would duplicate them
 *   pagamentos     = parcelas_pagar_raw net open balance due each day (minus withheld taxes/discount)
 *   input          = manual entries (entrada +, saída −)
 * An SPE whose running balance goes negative needs an aporte; the holding sends the
 * new shortfall of each day as an outflow ("Aportes enviados às SPEs").
 */
export function fluxoLive(this: AppLogic) {
  const s = this.state;
  const today = todayIso();
  const { from, to, anchor } = fluxoPeriodo(s);
  const n = daysBetween(anchor, to) + 1;
  const skip = daysBetween(anchor, from);
  const all = Array.from({ length: n }, (_, i) => addDays(anchor, i));
  const dates = all.slice(skip);
  const entry = this.rangeData('fluxo', anchor, to);
  const rows: FluxoDia[] = entry?.rows || [];
  const saldos = this.saldoPorEmpresa(anchor);
  const idx: Record<string, number> = Object.fromEntries(all.map((d, i) => [d, i]));
  const zeros = () => new Array(n).fill(0);

  // Empresas configured on the gear modal: their receivables are already committed.
  const semRec = new Set<number>((s.fxSemRec || []).map((x: any) => Number(x.cd)));

  const byCd: Record<number, any> = {};
  const get = (cd: number) => (byCd[cd] ||= { cd, caixa: saldos[cd] || 0, receitas: zeros(), pagamentos: zeros(), inputs: zeros(), recTypes: new Array(n).fill(null) });
  for (const r of rows) {
    const i = idx[r.dia];
    if (i == null) continue;
    const e = get(r.company_id);
    if (!semRec.has(Number(r.company_id)) && r.dia !== anchor) e.receitas[i] += Number(r.receber_caixa) || 0;
    e.pagamentos[i] += Number(r.pagar_aberto) || 0;
  }
  for (const l of s.lcRowsData || []) {
    const i = idx[l.date];
    if (i == null || !l.cd) continue;
    get(Number(l.cd)).inputs[i] += (l.tipo === 'saida' ? -1 : 1) * (Number(l.value) || 0);
  }
  for (const cd of Object.keys(saldos)) get(Number(cd));

  const running = (e: any, aportes?: number[]) => {
    let saldo = e.caixa;
    return e.receitas.map((_: number, i: number) => (saldo = saldo + e.receitas[i] - e.pagamentos[i] + e.inputs[i] - (aportes ? aportes[i] : 0))) as number[];
  };
  const shortDate = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
  const inDays = (i: number) => {
    const k = daysBetween(today, dates[i]);
    return k === 0 ? 'hoje' : k === 1 ? 'em 1 dia' : k > 1 ? `em ${k} dias` : `em ${shortDate(dates[i])}`;
  };

  const emps = Object.values(byCd)
    .sort((a: any, b: any) => (a.cd === HOLDING_ID ? -1 : b.cd === HOLDING_ID ? 1 : a.cd - b.cd))
    .map((e: any) => ({ cd: e.cd, name: e.cd === HOLDING_ID ? holdingNome(this.empresaById()[e.cd], this.empresaNome(e.cd)) : this.empresaNome(e.cd), kind: e.cd === HOLDING_ID ? 'holding' : 'spe', data: e }));

  const fxEmpSel: number[] = s.fxEmpSel || emps.map(e => e.cd);
  const selected = emps.filter(e => fxEmpSel.includes(e.cd));
  /** Aportes an SPE needs: each day, the growth of its shortfall (running balance below zero). */
  const needs = (cells: number[], upTo = cells.length) => {
    let prevDeficit = 0;
    return cells.slice(0, upTo).map(v => {
      const deficit = Math.max(0, -v);
      const a = Math.max(0, deficit - prevDeficit);
      prevDeficit = deficit;
      return a;
    });
  };
  const sumOf = (xs: number[]) => xs.reduce((t, v) => t + v, 0);
  // Days between today and a future `from` are only projected: the aportes of those days
  // go into the caixa inicial of the first day shown (SPE +, holding −, so they cancel out).
  const preAportes = zeros();
  const slice = (d: any, caixa: number) => ({ ...d, caixa, receitas: d.receitas.slice(skip), pagamentos: d.pagamentos.slice(skip), inputs: d.inputs.slice(skip), recTypes: d.recTypes.slice(skip) });
  const shown = selected.map(e => {
    if (skip === 0 || e.kind === 'holding') return e;
    const cells = running(e.data);
    const pre = needs(cells, skip);
    pre.forEach((v, i) => { preAportes[i] += v; });
    return { ...e, data: slice(e.data, cells[skip - 1] + sumOf(pre)) };
  }).map(e => (skip > 0 && e.kind === 'holding' ? { ...e, data: slice(e.data, running(e.data, preAportes)[skip - 1]) } : e));

  const aportes = new Array(dates.length).fill(0);
  const speBadges: Record<number, string> = {};
  for (const e of shown) {
    if (e.kind === 'holding') continue;
    const cells = running(e.data);
    needs(cells).forEach((v, i) => { aportes[i] += v; });
    const first = cells.findIndex(v => v < 0);
    if (first >= 0) speBadges[e.cd] = `Recebe aporte ${inDays(first)}`;
  }
  const holding = shown.find(e => e.kind === 'holding');
  const holdingCells = holding ? running(holding.data, aportes) : [];
  const holdingNeg = holdingCells.findIndex(v => v < 0);

  const groups = shown.map(e => ({
    cd: e.cd, key: e.cd, name: e.name,
    tag: e.kind === 'holding' ? 'Holding · origem dos aportes' : 'SPE',
    open: s['fxOpen_' + e.cd] !== false,
    badge: e.kind === 'holding' ? (holdingNeg >= 0 ? `Necessidade de caixa ${inDays(holdingNeg)}` : '') : (speBadges[e.cd] || ''),
    data: e.data,
    aportes: e.kind === 'holding' ? aportes : null,
  }));

  const br = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  return {
    loading: !entry || entry.status === 'loading',
    emps,
    groups,
    totalAportes: holding ? aportes.reduce((t, v) => t + v, 0) : 0,
    days: dates.map(shortDate),
    dows: dates.map(d => { const [y, m, dd] = d.split('-').map(Number); return DOWS[new Date(y, m - 1, dd).getDay()]; }),
    periodLabel: `${br(from)} – ${br(to)}`,
    holdingCells,
    running,
  };
}
