import type { AppLogic } from '../AppLogic';
import { todayIso } from '../../lib/api';
import type { TituloPagar } from '../data';

const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

/**
 * Programação do dia (live): open payables (net value) from parcelas_pagar_raw in the selected
 * period plus manual outflows, grouped by company, against the opening balance typed
 * in Saldos bancários for the first day of the period.
 */
export function progLiveGroups(this: AppLogic) {
  const s = this.state;
  const from = s.pgDateFrom || todayIso();
  const to = s.pgDateTo || from;
  const entry = this.rangeData('pagar', from, to);
  const titles: TituloPagar[] = entry?.rows || [];
  const off = s.pgOff || {};
  const today = todayIso();
  const saldos = this.saldoPorEmpresa(from);
  const byCd: Record<number, any> = {};
  const group = (cd: number, fallback?: string) =>
    (byCd[cd] ||= { cd, emp: this.empresaNome(cd, fallback), saldo: saldos[cd] || 0, items: [] as any[] });

  for (const t of titles) {
    const key = `t:${t.bill_id}:${t.installment_id}:${t.due_date}`;
    const doc = [t.document_id, t.document_number].filter(Boolean).join(' ');
    const when = t.due_date === today ? 'vence hoje' : `vence ${ddmm(t.due_date)}`;
    group(t.company_id, t.company_name).items.push({
      key, title: t.creditor_name || 'Credor não informado', sub: [doc, when, t.authorized ? '' : 'sem autorização'].filter(Boolean).join(' · '),
      tag: 'Título', val: Number(t.liquido ?? t.balance) || 0, on: !off[key], authorized: t.authorized, due: t.due_date,
    });
  }
  for (const l of s.lcRowsData || []) {
    if (l.tipo !== 'saida' || l.date < from || l.date > to || !l.cd) continue;
    const key = `m:${l.id}`;
    group(Number(l.cd), l.emp).items.push({
      key, title: l.desc, sub: `Lançamento manual · ${l.cat}`, tag: 'Manual', val: Number(l.value) || 0, on: !off[key], due: l.date,
    });
  }
  const groups = Object.values(byCd).sort((a: any, b: any) => a.cd - b.cd);
  const catalog = Object.values(this.empresaById()).map((e: any) => ({ id: String(e.id), name: e.label }));
  return { groups, catalog, loading: !entry || entry.status === 'loading' };
}
