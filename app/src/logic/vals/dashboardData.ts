import type { AppLogic } from '../AppLogic';
import { todayIso, addDays } from '../../lib/api';
import { DASH_BACK_DAYS, DASH_AHEAD_DAYS, dashPeriodStart, sumBy, type FluxoDia, type TituloPagar, type PagarSegmento, type PagoDia } from '../data';

const PALETTE = ['#4161FF', '#43B997', '#7C3AED', '#F59E0B', '#EC4899', '#0EA5E9'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const dateOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const initials = (name: string) => name.replace(/^(SPE|LTDA)\s+/i, '').split(/[\s–-]+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();

interface DayTotals { in: number; out: number; pago: number; juros: number; desc: number; recAb: number; pagAb: number }

/**
 * Live replacement for the dashboard's sample data (periodsData, empresas/grupos,
 * parcelas, targets). Shapes match what renderVals() already consumes.
 */
export function dashSource(this: AppLogic) {
  const s = this.state;
  const today = todayIso();
  const fluxo = this.rangeData('fluxo', addDays(today, -DASH_BACK_DAYS), addDays(today, DASH_AHEAD_DAYS));
  const pagar = this.rangeData('pagar', today, addDays(today, DASH_AHEAD_DAYS));
  const seg = this.rangeData('seg', dashPeriodStart(s.period), today);
  const fl: FluxoDia[] = fluxo?.rows || [];
  const pg: TituloPagar[] = pagar?.rows || [];
  const sg: PagarSegmento[] = seg?.rows || [];
  // Pago / juros / desconto by payment date (parcelas_pagar_payments), not by due date.
  const pagos = this.rangeData('pagos', addDays(today, -DASH_BACK_DAYS), today);
  const pgt: PagoDia[] = pagos?.rows || [];
  const loading = [fluxo, pagar, seg, pagos].some(r => !r || r.status === 'loading');
  // Payables are shown net (what is actually paid: minus withheld taxes and discount).
  const net = (t: TituloPagar) => Number(t.liquido ?? t.balance) || 0;

  const byDay: Record<string, DayTotals> = {};
  for (const r of fl) {
    const d = (byDay[r.dia] ||= { in: 0, out: 0, pago: 0, juros: 0, desc: 0, recAb: 0, pagAb: 0 });
    d.in += Number(r.receber_original) || 0;
    d.out += Number(r.pagar_liquido ?? r.pagar_original) || 0;
    d.recAb += Number(r.receber_aberto) || 0;
    d.pagAb += Number(r.pagar_aberto) || 0;
  }
  for (const r of pgt) {
    const d = (byDay[r.dia] ||= { in: 0, out: 0, pago: 0, juros: 0, desc: 0, recAb: 0, pagAb: 0 });
    d.pago += Number(r.pago) || 0;
    d.juros += Number(r.juros) || 0;
    d.desc += Number(r.desconto) || 0;
  }
  // skipTodayIn: in the per-day views (Diário, Semanal) today's parcelas a receber are
  // already in today's bank balance (Saldos bancários); counting them again duplicates them.
  const bucket = (x: string, from: string, to: string, skipTodayIn = false) => {
    const t = { x, in: 0, out: 0, pago: 0, juros: 0, desc: 0 };
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const v = byDay[d];
      if (!v) continue;
      if (!(skipTodayIn && d === today)) t.in += v.in;
      t.out += v.out; t.pago += v.pago; t.juros += v.juros; t.desc += v.desc;
    }
    return t;
  };
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const periodsData: any = {
    D: { label: 'Diário', sub: 'Entradas vs. saídas por vencimento · hoje', data: [bucket('Hoje', today, today, true)] },
    '7D': { label: 'Semanal', sub: 'Entradas vs. saídas por vencimento · últimos 7 dias', data: last7.map(d => bucket(WEEKDAYS[dateOf(d).getDay()], d, d, true)) },
    '30D': { label: 'Mensal', sub: 'Entradas vs. saídas por vencimento · últimas 5 semanas', data: Array.from({ length: 5 }, (_, i) => { const end = addDays(today, -7 * (4 - i)); return bucket(`Sem ${i + 1}`, addDays(end, -6), end); }) },
    '90D': { label: 'Trimestral', sub: 'Entradas vs. saídas por vencimento · últimos 3 meses', data: ['Mês -2', 'Mês -1', 'Mês atual'].map((x, i) => { const end = addDays(today, -30 * (2 - i)); return bucket(x, addDays(end, -29), end); }) },
  };

  // Ranking por empresa / diluição por segmento (valor original a pagar no período).
  const empresaById = this.empresaById();
  const byCompany: Record<number, { total: number; g: Record<string, number> }> = {};
  const segTotals: Record<string, number> = {};
  for (const r of sg) {
    const c = (byCompany[r.company_id] ||= { total: 0, g: {} });
    const v = Number(r.total) || 0;
    c.total += v;
    c.g[r.segmento] = (c.g[r.segmento] || 0) + v;
    segTotals[r.segmento] = (segTotals[r.segmento] || 0) + v;
  }
  const grupoOrder = Object.keys(segTotals).sort((a, b) => segTotals[b] - segTotals[a]).slice(0, 5);
  const grupoColors: Record<string, string> = Object.fromEntries(grupoOrder.map((g, i) => [g, PALETTE[i % PALETTE.length]]));
  const empresas = Object.entries(byCompany)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([id, c], i) => {
      const n = empresaById[Number(id)]?.label || `Empresa ${id}`;
      return { id, n, s: initials(n), c: PALETTE[i % PALETTE.length], g: c.g };
    });

  // Linha do tempo: próximos vencimentos a pagar, agrupados por dia + empresa.
  const groups: Record<string, { date: string; company: number; total: number; titles: TituloPagar[] }> = {};
  for (const t of pg) {
    const k = `${t.due_date}|${t.company_id}`;
    const g = (groups[k] ||= { date: t.due_date, company: t.company_id, total: 0, titles: [] });
    g.total += net(t);
    g.titles.push(t);
  }
  const parcelas = Object.values(groups)
    .sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1))
    .slice(0, 8)
    .map(g => {
      const dt = dateOf(g.date);
      const days = Math.round((dt.getTime() - dateOf(today).getTime()) / 86400000);
      const top = g.titles.slice().sort((a, b) => net(b) - net(a))[0];
      const more = g.titles.length > 1 ? ` + ${g.titles.length - 1}` : '';
      const tone = days <= 0 ? '#EF4444' : days <= 3 ? '#F59E0B' : days <= 10 ? '#4161FF' : days <= 20 ? '#7C3AED' : '#43B997';
      return {
        d: String(dt.getDate()).padStart(2, '0'), m: MONTHS[dt.getMonth()], wd: WEEKDAYS_LONG[dt.getDay()],
        emp: empresaById[g.company]?.label || top.company_name,
        desc: `${top.creditor_name || 'Credor não informado'}${top.document_id ? ` · ${top.document_id} ${top.document_number || ''}`.trimEnd() : ''}${more}`,
        v: g.total,
        st: days <= 0 ? 'Vence hoje' : days === 1 ? 'amanhã' : `em ${days} dias`,
        tone, urgent: days <= 0,
      };
    });

  const dueToday = pg.filter(t => t.due_date === today);
  const in7 = pg.filter(t => t.due_date <= addDays(today, 6));
  const in10 = pg.filter(t => t.due_date > today && t.due_date <= addDays(today, 10));

  // KPIs
  const yest = addDays(today, -1);
  const tday = byDay[today] || ({} as DayTotals);
  const yday = byDay[yest] || ({} as DayTotals);
  const delta = (a = 0, b = 0) => {
    if (!b) return a ? 'sem base de comparação' : 'sem movimento';
    const pct = ((a - b) / b) * 100;
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1).replace('.', ',')}% vs. ontem`;
  };
  const saldos = this.readSaldos()[today] || {};
  const contas = (s.dbContas || []).length;
  const informadas = Object.keys(saldos).length;
  const manuais = (s.lcRowsData || []).filter((l: any) => l.tipo === 'saida' && l.sit === 'previsto' && l.date >= today && l.date <= addDays(today, 6));
  let prev7 = sumBy(manuais, (l: any) => l.value);
  for (let d = today; d <= addDays(today, 6); d = addDays(d, 1)) prev7 += byDay[d]?.pagAb || 0;
  const nPrev = in7.length + manuais.length;

  return {
    loading,
    periodsData,
    empresas,
    grupoOrder,
    grupoColors,
    parcelas,
    targets: {
      receber: tday.in || 0,
      pagar: tday.out || 0,
      saldo: sumBy(Object.values(saldos) as any[], (v: any) => v.saldo),
      previsao: prev7,
    },
    kpiReceberDelta: delta(tday.in, yday.in),
    kpiPagarDelta: delta(tday.out, yday.out),
    kpiSaldoSub: contas ? `${informadas} de ${contas} contas com saldo do dia` : 'Nenhuma conta carregada',
    kpiPrevisaoSub: `${nPrev} ${nPrev === 1 ? 'lançamento previsto' : 'lançamentos previstos'}`,
    parcelasTodayLabel: dueToday.length ? `${dueToday.length} ${dueToday.length === 1 ? 'parcela vence hoje' : 'parcelas vencem hoje'}` : 'Nenhuma parcela vence hoje',
    vencendo7Label: `${in7.length} ${in7.length === 1 ? 'parcela' : 'parcelas'}`,
    dueTodayCount: dueToday.length,
    dueTodayValue: sumBy(dueToday, net),
    next10Count: in10.length,
  };
}
