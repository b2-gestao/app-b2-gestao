import type { AppLogic } from '../AppLogic';
import { progLiveGroups } from './programacaoData';
import { todayIso } from '../../lib/api';
import { progInsights } from '../insights';
import { exportProgramacaoXlsx } from '../programacaoExcel';

export function progVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const live = this.live ? progLiveGroups.call(this) : null;
  const allGroups = live ? live.groups : (s.pgGroups || this.pgSeed());
  const f2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const show = s.pgShow || 'Todas';
  const closed = !!s.pgClosed;
  const semRec = new Set<number>((s.fxSemRec || []).map(x => Number(x.cd)));

  const empCatalog = live ? live.catalog : this.pgSeed().map(g => ({ id: String(g.cd), name: g.emp }));
  const empAllNames = empCatalog.map(c => c.name);
  const pgEmpSel = s.pgEmpSel || empAllNames;
  const groups = allGroups.filter(g => pgEmpSel.indexOf(g.emp) >= 0);
  const ddPgEmp = this.mkMultiDropdown('pgEmp', s, pgEmpSel, empCatalog,
    name => this.setState({ pgEmpSel: pgEmpSel.indexOf(name) >= 0 ? pgEmpSel.filter(x => x !== name) : pgEmpSel.concat([name]) }),
    list => this.setState({ pgEmpSel: list }));
  const savedDefault = s.pgEmpDefault;
  const isSavedMatch = !!savedDefault && savedDefault.length === pgEmpSel.length && savedDefault.every(n => pgEmpSel.indexOf(n) >= 0);

  let totSaldo = 0, totContas = 0, totRec = 0, totTit = 0, totMan = 0, totAporte = 0, totCount = 0;
  const offRows: any[] = [];
  const rows = groups.map(g => {
    const onItems = g.items.filter(it => it.on);
    const offItems = g.items.filter(it => !it.on);
    offItems.forEach(it => offRows.push({ cd: g.cd, emp: g.emp, title: it.title, tag: it.tag, val: it.val, groupCd: g.cd, key: it.key }));
    if (show === 'Pendentes' && onItems.length === 0) return null;
    const tit = onItems.filter(i => i.tag === 'Título').reduce((t, i) => t + i.val, 0);
    const man = onItems.filter(i => i.tag === 'Manual').reduce((t, i) => t + i.val, 0);
    const total = tit + man;
    const after = g.saldo - total;
    const aporte = after < 0 ? -after : 0;
    const contas = g.contas ?? g.saldo, rec = g.receber || 0;
    totSaldo += g.saldo; totContas += contas; totRec += rec; totTit += tit; totMan += man; totAporte += aporte; totCount += onItems.length;
    const open = s['pgOpen_' + g.cd] === true;
    return {
      cd: g.cd, emp: g.emp, saldo: f2(g.saldo),
      saldoTip: `Contas ${f2(contas)} + a receber ${f2(rec)}${semRec.has(Number(g.cd)) ? ' (plano empresário: recebíveis não considerados)' : ''}`,
      tit: tit ? '−' + f2(tit) : '—',
      man: man ? '−' + f2(man) : '—',
      manStyle: `text-align:right;font-size:13px;color:${man ? '#DC2626' : '#94A3B8'};font-variant-numeric:tabular-nums`,
      total: f2(total),
      after: f2(after), afterStyle: `text-align:right;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:${after < 0 ? '#DC2626' : '#111827'}`,
      aporte: aporte ? f2(aporte) : '—',
      aporteStyle: `font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;${aporte ? 'background:#F1E9FF;color:#7C3AED' : 'color:#CBD5E1'}`,
      count: `${onItems.length}${offItems.length ? ` (+${offItems.length} fora)` : ''}`,
      open, chevStyle: `transition:transform .18s;transform:rotate(${open ? 90 : 0}deg)`,
      toggle: () => this.setState({ ['pgOpen_' + g.cd]: !open }),
      rowStyle: `display:grid;grid-template-columns:28px minmax(230px,1fr) 124px 124px 110px 124px 124px 130px 52px 74px;gap:12px;align-items:center;padding:10px 18px;cursor:pointer;box-shadow:inset 0 -1px 0 #F4F4F6;transition:background .15s`,
      hoverStyle: 'background:#FAFAFB',
      items: onItems.map((it, i) => ({
        title: it.title, sub: it.sub, tag: it.tag,
        tagStyle: `font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap;${it.tag === 'Título' ? 'background:#EAF1FF;color:#2445E8' : 'background:#F1E9FF;color:#7C3AED'}`,
        val: '−' + f2(it.val),
        boxStyle: `width:16px;height:16px;border-radius:5px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#43B997;transition:background .15s`,
        toggle: () => (live ? this.setState(st => ({ pgOff: { ...(st.pgOff || {}), [it.key]: true } })) : this.setPg(list => list.map(x => x.cd === g.cd ? Object.assign({}, x, { items: x.items.map(y => y === it ? Object.assign({}, y, { on: false }) : y) }) : x))),
      })),
    };
  }).filter(Boolean);


  // Empresas com plano empresário vigente (engrenagem do Fluxo de caixa): recebíveis fora.
  const planoNomes = [...semRec].map(cd => this.live ? this.empresaNome(cd) : `Empresa ${cd}`);
  const saldoNote = 'Sem bens, permutas e financiamento'
    + (planoNomes.length ? `\nExclui plano empresário: ${planoNomes.length} empresa${planoNomes.length > 1 ? 's' : ''}` : '');
  const noteStyle = (on: boolean) => `display:${on ? 'block' : 'none'};font-size:11px;line-height:1.45;color:#94A3B8;white-space:pre-line;text-wrap:pretty;cursor:default`;
  const cardBase = i => `display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03);opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${100 + i * 50}ms;transition:transform .2s ease`;
  const pgCards = [
    {
      label: 'Saldo inicial do dia', val: f2(totSaldo),
      sub: `Contas ${f2(totContas)} + receber ${f2(totRec)}`,
      note: saldoNote, noteStyle: noteStyle(true),
      noteTip: planoNomes.length ? `Plano empresário vigente (recebíveis não considerados):\n${planoNomes.join('\n')}` : '',
      style: cardBase(0), valStyle: 'font-size:21px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums',
    },
    { label: 'Títulos Sienge', val: '−' + f2(totTit), sub: 'Parcelas em aberto no período', style: cardBase(1), valStyle: 'font-size:21px;font-weight:700;color:#DC2626;font-variant-numeric:tabular-nums' },
    { label: 'Lançamentos manuais', val: '−' + f2(totMan), sub: 'Entram na programação', style: cardBase(2), valStyle: 'font-size:21px;font-weight:700;color:#DC2626;font-variant-numeric:tabular-nums' },
    { label: 'Aporte necessário', val: f2(totAporte), sub: totAporte ? 'Empresas com saldo insuficiente' : 'Nenhuma empresa precisa de aporte', style: cardBase(3), valStyle: `font-size:21px;font-weight:700;color:${totAporte ? '#7C3AED' : '#111827'};font-variant-numeric:tabular-nums` },
    { label: 'Saldo após pagamentos', val: f2(totSaldo - totTit - totMan), sub: 'Consolidado do dia', style: cardBase(4), valStyle: 'font-size:21px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums' },
  ].map(c => ({ note: '', noteTip: '', noteStyle: noteStyle(false), ...c }));

  const ia = this.live && s.page === 'programacao' ? this.iaBanner('prog', progInsights(this)) : null;
  return {
    iaProgHeadline: ia ? ia.headline : 'Saldo insuficiente na conta Itaú · Obras Ltda para cobrir os pagamentos de hoje — faltam R$ 18.400',
    iaProgSub: ia ? ia.sub : 'Análise com IA · 3 pontos de atenção na programação de hoje',
    iaProgBtnLabel: ia ? ia.btn : 'Ver análise',
    isProg: s.page === 'programacao',
    progItemStyle: s.page === 'programacao' ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997' : subItemStyle,
    goProg: e => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'programacao', module: 'Financeiro', financeiroOpen: true, userMenuOpen: false }); },
    pgStatusLabel: closed ? 'Programação fechada' : 'Aberta · em edição',
    pgStatusPill: `display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:${closed ? '#F1E9FF' : '#E1F7EF'};color:${closed ? '#7C3AED' : '#258B6C'}`,
    pgStatusDot: `width:7px;height:7px;border-radius:50%;background:${closed ? '#7C3AED' : '#43B997'};${closed ? '' : 'animation:blink 1.6s ease-in-out infinite'}`,
    pgExport: () => {
      if (!groups.length) { this.toast('Nenhuma empresa selecionada para exportar.'); return; }
      const from = s.pgDateFrom || (this.live ? todayIso() : '2026-09-23');
      const file = exportProgramacaoXlsx(groups, from, s.pgDateTo || from);
      this.toast(`Programação exportada para Excel · ${file}`);
    },
    pgToggleClose: () => { this.setState({ pgClosed: !closed }); this.toast(!closed ? 'Programação do dia fechada.' : 'Programação reaberta para edição.'); },
    pgCloseBtnStyle: `display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:9px;border:1px solid ${closed ? '#E4D6FF' : '#E7E7EA'};background:${closed ? '#F1E9FF' : '#FFFFFF'};color:${closed ? '#7C3AED' : '#374151'};font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s`,
    pgLockPath: closed ? 'M9 10.5V8a3 3 0 016 0v2.5' : 'M9 10.5V8a3 3 0 015.7-1.3',
    pgCloseLabel: closed ? 'Reabrir programação' : 'Fechar programação',
    pgPrevDay: () => {},
    pgNextDay: () => {},
    pgDayLabel: '',
    pgTodayPill: 'font-size:10.5px;font-weight:600;color:#258B6C;background:#E1F7EF;border-radius:20px;padding:3px 9px',
    pgExpandAll: () => this.setState(Object.fromEntries(groups.map(g => ['pgOpen_' + g.cd, true]))),
    pgCollapseAll: () => this.setState(Object.fromEntries(groups.map(g => ['pgOpen_' + g.cd, false]))),
    pgPeriods: ['Diário', 'Semanal', 'Mensal', 'Trimestral'].map(p => {
      const period = this.state.pgPeriod || 'Diário';
      const isPg = period === p;
      return { label: p, style: `border:none;border-radius:6px;padding:0 10px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${isPg ? '#111827' : '#F4F4F6'};color:${isPg ? '#FFFFFF' : '#64748B'}`, onClick: () => this.setState({ pgPeriod: p, ...this.getDateRangeForPeriod(p) }) };
    }),
    pgDateFrom: this.state.pgDateFrom || (this.live ? todayIso() : '2026-09-23'),
    pgDateTo: this.state.pgDateTo || (this.live ? todayIso() : '2026-09-23'),
    onDateFromChange: (e) => this.setState({ pgDateFrom: e.target.value }),
    onDateToChange: (e) => this.setState({ pgDateTo: e.target.value }),
    ddPgEmp,
    pgEmpEmptyStyle: `display:${groups.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:36px 20px;text-align:center`,
    pgSaveDefaultView: () => {
      try { localStorage.setItem('he_prog_empresas_default', JSON.stringify(pgEmpSel)); } catch { /* storage blocked */ }
      this.setState({ pgEmpDefault: pgEmpSel.slice() });
      this.toast(`Visão padrão salva \u00b7 ${pgEmpSel.length} de ${empAllNames.length} empresas.`);
    },
    pgSaveViewLabel: isSavedMatch ? 'Visão padrão salva' : 'Salvar como visão padrão',
    pgSaveViewStyle: `display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid ${isSavedMatch ? '#C7EEE0' : '#E7E7EA'};background:${isSavedMatch ? '#E1F7EF' : '#FFFFFF'};color:${isSavedMatch ? '#258B6C' : '#374151'};font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap`,
    pgCards,
    pgRows: rows,
    pgTot: {
      saldo: f2(totSaldo), tit: '−' + f2(totTit), man: '−' + f2(totMan), total: f2(totTit + totMan),
      aporte: totAporte ? f2(totAporte) : '—', count: totCount,
    },
    pgHasOff: offRows.length > 0,
    pgOffCount: offRows.length,
    pgOffTotal: f2(offRows.reduce((t, o) => t + o.val, 0)),
    pgOffRows: offRows.map(o => ({
      cd: o.cd, title: o.title, emp: o.emp,
      tag: 'Fora', tagStyle: 'font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:20px;background:#FFF0DD;color:#B45309;white-space:nowrap',
      val: f2(o.val),
      restore: () => (live ? this.setState(st => { const off = { ...(st.pgOff || {}) }; delete off[o.key]; return { pgOff: off }; }) : this.setPg(list => list.map(x => x.cd === o.groupCd ? Object.assign({}, x, { items: x.items.map(y => y.title === o.title ? Object.assign({}, y, { on: true }) : y) }) : x))),
    })),
  };
}
