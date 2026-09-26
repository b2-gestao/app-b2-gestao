import type { AppLogic } from '../AppLogic';
import { todayIso, type ReceberEmpresa } from '../../lib/api';
import type { TituloPagar } from '../data';

const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

/**
 * Programação do dia (live): open payables (net value) from parcelas_pagar_raw in the selected
 * period plus manual outflows, grouped by company, against the opening balance:
 *   saldo = contas (typed in Saldos bancários for the first day of the period)
 *         + receber (open parcelas a receber due in the period, app_receber_periodo —
 *           no Bens, Permuta or Financiamento; zero for the companies with plano
 *           empresário, app_fluxo_empresas_sem_receber / state.fxSemRec)
 */
export function progLiveGroups(this: AppLogic) {
  const s = this.state;
  const from = s.pgDateFrom || todayIso();
  const to = s.pgDateTo || from;
  const entry = this.rangeData('pagar', from, to);
  const recEntry = this.rangeData('receber', from, to);
  const titles: TituloPagar[] = entry?.rows || [];
  const off = s.pgOff || {};
  const today = todayIso();
  const saldos = this.saldoPorEmpresa(from);
  const semRec = new Set<number>((s.fxSemRec || []).map((x: any) => Number(x.cd)));
  const receber: Record<number, number> = {};
  for (const r of (recEntry?.rows || []) as ReceberEmpresa[]) {
    if (!semRec.has(Number(r.company_id))) receber[r.company_id] = (receber[r.company_id] || 0) + (Number(r.receber_aberto) || 0);
  }
  const byCd: Record<number, any> = {};
  const group = (cd: number, fallback?: string) => (byCd[cd] ||= {
    cd, emp: this.empresaNome(cd, fallback),
    contas: saldos[cd] || 0, receber: receber[cd] || 0, saldo: (saldos[cd] || 0) + (receber[cd] || 0),
    items: [] as any[],
  });
  // Every company with an opening balance or receivables counts, even with nothing to pay
  // in the period, so the total matches Saldos bancários.
  for (const cd of Object.keys(saldos)) if (saldos[Number(cd)]) group(Number(cd));
  for (const cd of Object.keys(receber)) if (receber[Number(cd)]) group(Number(cd));

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
  return {
    groups, catalog, semRec: [...semRec],
    loading: !entry || entry.status === 'loading' || !recEntry || recEntry.status === 'loading',
  };
}
