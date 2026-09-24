import type { AppLogic } from '../AppLogic';
import { todayIso, addDays } from '../../lib/api';
import { FLUXO_DAYS, type FluxoDia } from '../data';

const DOWS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Company that funds the SPEs ("Holding · origem dos aportes"). The prototype used
 * Sienge company 2; override with VITE_HOLDING_EMPRESA_ID.
 */
export const HOLDING_ID = Number(import.meta.env.VITE_HOLDING_EMPRESA_ID || 2);

/** The holding is linked to every SPE's empreendimento in De Para; show only its own name. */
const holdingNome = (e: any, fallback: string) => (e && (e.nome_fantasia || e.nome || '').trim()) || fallback;

/**
 * Fluxo de caixa (live), 10 days from today, per company:
 *   caixa inicial  = opening balance typed in Saldos bancários for today
 *   receitas       = parcelas_receber open balance due each day (zero for the companies
 *                    in app_fluxo_empresas_sem_receber, state.fxSemRec)
 *   pagamentos     = parcelas_pagar_raw open balance due each day
 *   input          = manual entries (entrada +, saída −)
 * An SPE whose running balance goes negative needs an aporte; the holding sends the
 * new shortfall of each day as an outflow ("Aportes enviados às SPEs").
 */
export function fluxoLive(this: AppLogic) {
  const s = this.state;
  const today = todayIso();
  const dates = Array.from({ length: FLUXO_DAYS }, (_, i) => addDays(today, i));
  const entry = this.rangeData('fluxo', today, dates[dates.length - 1]);
  const rows: FluxoDia[] = entry?.rows || [];
  const saldos = this.saldoPorEmpresa(today);
  const idx: Record<string, number> = Object.fromEntries(dates.map((d, i) => [d, i]));
  const zeros = () => new Array(FLUXO_DAYS).fill(0);

  // Empresas configured on the gear modal: their receivables are already committed.
  const semRec = new Set<number>((s.fxSemRec || []).map((x: any) => Number(x.cd)));

  const byCd: Record<number, any> = {};
  const get = (cd: number) => (byCd[cd] ||= { cd, caixa: saldos[cd] || 0, receitas: zeros(), pagamentos: zeros(), inputs: zeros(), recTypes: new Array(FLUXO_DAYS).fill(null) });
  for (const r of rows) {
    const i = idx[r.dia];
    if (i == null) continue;
    const e = get(r.company_id);
    if (!semRec.has(Number(r.company_id))) e.receitas[i] += Number(r.receber_aberto) || 0;
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
    return dates.map((_, i) => (saldo = saldo + e.receitas[i] - e.pagamentos[i] + e.inputs[i] - (aportes ? aportes[i] : 0)));
  };
  const inDays = (i: number) => (i === 0 ? 'hoje' : i === 1 ? 'em 1 dia' : `em ${i} dias`);

  const emps = Object.values(byCd)
    .sort((a: any, b: any) => (a.cd === HOLDING_ID ? -1 : b.cd === HOLDING_ID ? 1 : a.cd - b.cd))
    .map((e: any) => ({ cd: e.cd, name: e.cd === HOLDING_ID ? holdingNome(this.empresaById()[e.cd], this.empresaNome(e.cd)) : this.empresaNome(e.cd), kind: e.cd === HOLDING_ID ? 'holding' : 'spe', data: e }));

  const fxEmpSel: number[] = s.fxEmpSel || emps.map(e => e.cd);
  const selected = emps.filter(e => fxEmpSel.includes(e.cd));
  const aportes = zeros();
  const speBadges: Record<number, string> = {};
  for (const e of selected) {
    if (e.kind === 'holding') continue;
    const cells = running(e.data);
    let prevDeficit = 0;
    cells.forEach((v, i) => {
      const deficit = Math.max(0, -v);
      if (deficit > prevDeficit) aportes[i] += deficit - prevDeficit;
      prevDeficit = deficit;
    });
    const first = cells.findIndex(v => v < 0);
    if (first >= 0) speBadges[e.cd] = `Recebe aporte ${inDays(first)}`;
  }
  const holding = selected.find(e => e.kind === 'holding');
  const holdingCells = holding ? running(holding.data, aportes) : [];
  const holdingNeg = holdingCells.findIndex(v => v < 0);

  const groups = selected.map(e => ({
    cd: e.cd, key: e.cd, name: e.name,
    tag: e.kind === 'holding' ? 'Holding · origem dos aportes' : 'SPE',
    open: s['fxOpen_' + e.cd] !== false,
    badge: e.kind === 'holding' ? (holdingNeg >= 0 ? `Necessidade de caixa ${inDays(holdingNeg)}` : '') : (speBadges[e.cd] || ''),
    data: e.data,
    aportes: e.kind === 'holding' ? aportes : null,
  }));

  const [, m0, d0] = dates[0].split('-');
  const [y9, m9, d9] = dates[dates.length - 1].split('-');
  return {
    loading: !entry || entry.status === 'loading',
    emps,
    groups,
    totalAportes: holding ? aportes.reduce((t, v) => t + v, 0) : 0,
    days: dates.map(d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; }),
    dows: dates.map(d => { const [y, m, dd] = d.split('-').map(Number); return DOWS[new Date(y, m - 1, dd).getDay()]; }),
    periodLabel: `${d0}/${m0}/${today.slice(0, 4)} – ${d9}/${m9}/${y9}`,
    holdingCells,
    running,
  };
}
