import type { AppLogic } from '../AppLogic';
import { fluxoLive, fluxoPeriodo, daysBetween, FLUXO_MAX_DAYS } from './fluxoData';
import { addDays } from '../../lib/api';
import { fluxoInsights } from '../insights';
import { fluxoCfgVals } from './fluxoCfg';

export function fluxoVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = this.live ? fluxoLive.call(this) : null;
  // Demo mode: the prototype's sample starts on 23/09/2026.
  const DEMO_START = '2026-09-23';
  const P = fluxoPeriodo(L ? s : { fxDateFrom: s.fxDateFrom || DEMO_START, fxDateTo: s.fxDateTo });
  const demoDates = L ? [] : Array.from({ length: daysBetween(P.from, P.to) + 1 }, (_, i) => addDays(P.from, i));
  const days = L ? L.days : demoDates.map(d => d.slice(8, 10) + '/' + d.slice(5, 7));
  const dows = L ? L.dows : demoDates.map(d => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(d + 'T12:00').getDay()]);
  const N = days.length;
  const gridCols = `220px repeat(${N},104px)`;
  const view = s.fxView || 'Consolidado';
  const emps = L ? L.emps : this.fxSeed();
  const recAll = ['FI · Financiamento', 'BE · Bens', 'PT · Permuta', 'Contas a receber'];
  const fxRecSel = s.fxRecSel || recAll.slice();
  const fxEmpSel = s.fxEmpSel || emps.map(e => e.cd);
  const fxSavedDefault = s.fxEmpDefault;
  const fxIsSavedMatch = !!fxSavedDefault && fxSavedDefault.length === fxEmpSel.length && fxSavedDefault.every(c => fxEmpSel.indexOf(c) >= 0);

  const seriesFor = (caixa, receitas, pagamentos, inputs, aportes?) => {
    let saldo = caixa;
    const cells: any[] = [];
    for (let i = 0; i < receitas.length; i++) { saldo = saldo + receitas[i] - pagamentos[i] + inputs[i] - (aportes ? (aportes[i] || 0) : 0); cells.push(saldo); }
    return cells;
  };

  // Demo arrays cover 23/09–02/10; other days of the chosen period are zero.
  const demoAt = (arr: any[], fill: any) => demoDates.map(d => { const k = daysBetween(DEMO_START, d); return k >= 0 && k < arr.length ? arr[k] : fill; });
  const demo = e => ({ caixa: e.caixa, receitas: demoAt(e.receitas, 0), recTypes: demoAt(e.recTypes, null), pagamentos: demoAt(e.pagamentos, 0), inputs: demoAt(e.inputs, 0) });
  const holding = { caixa: 1102.14, receitas: [0, 28500, 0, 0, 0, 0, 0, 0, 1250000, 0], recTypes: [null, 'Contas a receber', null, null, null, null, null, null, 'FI · Financiamento', null], pagamentos: [8000, 0, 3137.66, 0, 0, 0, 0, 12450, 0, 0], inputs: [-7300, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const laguna = { caixa: 150029.59, receitas: [0, 0, 86400, 0, 0, 0, 0, 41250, 0, 0], recTypes: [null, null, 'BE · Bens', null, null, null, null, 'Contas a receber', null, null], pagamentos: [12131.61, 18320.40, 0, 0, 0, 0, 6880, 0, 22415.90, 0], inputs: [0, 0, 0, 0, 0, 0, -514328.48, 0, 0, 0] };
  const zoe = { caixa: 220.24, receitas: [0, 0, 0, 0, 0, 312500, 0, 0, 0, 0], recTypes: [null, null, null, null, null, 'PT · Permuta', null, null, null, null], pagamentos: [232, 4870, 0, 0, 0, 0, 0, 15600, 0, 0], inputs: [0, 0, -198028.93, 0, 0, -1271463.02, 0, -1126243.20, 0, 0] };

  const applyRecFilter = e => e.receitas.map((v, i) => (fxRecSel.includes(e.recTypes[i] || 'Contas a receber') ? v : 0));

  // Empresas sem recebíveis (engrenagem). Live data already comes zeroed from fluxoLive.
  const semRec: Record<number, string> = Object.fromEntries((s.fxSemRec || []).map(x => [x.cd, x.motivo]));

  const buildLines = (semReceitas, e0, aportes, recFiltered?) => {
    const e = recFiltered ? e0 : Object.assign({}, e0, { receitas: applyRecFilter(e0) });
    const saldoCells = seriesFor(e.caixa, e.receitas, e.pagamentos, e.inputs, aportes);
    const caixaRow = [e.caixa].concat(saldoCells.slice(0, N - 1));
    const mk = (op, lbl, vals, color?, weight?, indent?) => ({
      op, opStyle: `font-size:11px;font-weight:700;color:${op === '(=)' ? '#4161FF' : '#94A3B8'};width:22px;flex:none`,
      label: lbl, indent: indent || 0, labelColor: color || '#374151', labelWeight: weight || 500,
      labelStyle: `font-size:12.5px;color:${color || '#374151'};font-weight:${weight || 500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
      rowStyle: `display:grid;grid-template-columns:${gridCols};gap:0;padding:7px 18px;box-shadow:inset 0 -1px 0 #F7F7F9`,
      cells: vals.map(v => ({ val: v == null ? '–' : f2(v), style: `text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:${v < 0 ? '#DC2626' : (color || '#374151')};font-weight:${weight || 400}` })),
    });
    const lines = [
      mk('(=)', 'Caixa inicial', caixaRow, '#111827', 600),
      mk('(+)', semReceitas ? 'Receitas (desconsideradas)' : 'Receitas', e.receitas.map(v => v || null), '#258B6C'),
      mk('(−)', 'Pagamentos (títulos)', e.pagamentos.map(v => v ? -v : null), '#DC2626'),
      mk('(+/−)', 'Input (lançamentos manuais)', e.inputs.map(v => v || null), '#7C3AED'),
    ];
    if (aportes) lines.push(mk('(−)', 'Aportes enviados às SPEs', aportes.map(v => v ? -v : null), '#7C3AED'));
    lines.push(mk('(=)', 'Saldo final', saldoCells, '#111827', 700));
    return lines;
  };

  const baseGroups = L ? L.groups : [
    { cd: 2, name: 'Habitat Construtora e Incorp.', tag: 'Holding · origem dos aportes', open: s.fxOpen_2 !== false, key: 2, badge: 'Necessidade de caixa em 9 dias', data: demo(holding), aportes: demoAt([5152.95, 4870, 384307.91, 0, 0, 958963.02, 315230.90, 1141843.20, 204778.59, 0], 0) },
    { cd: 238, name: 'SPE Rio Verde VII – Zoe', tag: 'SPE', open: s.fxOpen_238 !== false, key: 238, badge: 'Recebe aporte em 5 dias', data: demo(zoe), aportes: null },
    { cd: 191, name: 'SPE Rio Verde I – Laguna', tag: 'SPE', open: s.fxOpen_191 !== false, key: 191, badge: 'Recebe aporte em 1 dia', data: demo(laguna), aportes: null },
  ];
  const perEmp = baseGroups.filter(g => fxEmpSel.includes(g.cd)).map(g => (semRec[g.cd] != null && !L
    ? { ...g, data: { ...g.data, receitas: g.data.receitas.map(() => 0) } }
    : g)).map(g => ({
    ...g,
    toggle: () => this.setState({ ['fxOpen_' + g.key]: !g.open }),
    chevStyle: `transition:transform .18s;transform:rotate(${g.open ? 90 : 0}deg)`,
    headStyle: `display:flex;align-items:center;gap:10px;padding:11px 18px;cursor:pointer;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1;transition:background .15s`,
    headHover: 'background:#F4F4F6',
    tagStyle: `font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:${g.tag === 'Holding · origem dos aportes' ? '#F1E9FF' : '#EAF1FF'};color:${g.tag === 'Holding · origem dos aportes' ? '#7C3AED' : '#2445E8'};white-space:nowrap`,
    badgeStyle: `display:${g.badge ? 'inline' : 'none'};font-size:11px;font-weight:600;color:#B45309;background:#FFF0DD;border-radius:20px;padding:3px 9px;white-space:nowrap`,
    semRecStyle: `display:${semRec[g.cd] != null ? 'inline-flex' : 'none'};font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:#F1F1F3;color:#64748B;white-space:nowrap;cursor:help`,
    semRecTitle: semRec[g.cd] != null ? `Parcelas a receber desconsideradas · ${semRec[g.cd]}` : '',
    lines: buildLines(semRec[g.cd] != null, g.data, g.aportes),
  }));

  let sumCaixa = 0, sumRec = 0, sumPag = 0, sumInputs = 0, sumFinal = 0;
  perEmp.forEach(g => {
    const src = g.data;
    const filteredRec = applyRecFilter(src);
    const saldoCells = seriesFor(src.caixa, filteredRec, src.pagamentos, src.inputs);
    sumCaixa += src.caixa;
    sumRec += filteredRec.reduce((t, v) => t + v, 0);
    sumPag += src.pagamentos.reduce((t, v) => t + v, 0);
    sumInputs += src.inputs.reduce((t, v) => t + v, 0);
    sumFinal += saldoCells[saldoCells.length - 1];
  });
  // Visão "Consolidado": one block summing the companies in the filter. Aportes are
  // transfers between them, so they cancel out and are not a line here.
  const sumArr = (pick: (g: any) => number[]) => days.map((_, i) => perEmp.reduce((t, g) => t + (pick(g)[i] || 0), 0));
  const consData = {
    caixa: sumCaixa,
    receitas: sumArr(g => applyRecFilter(g.data)),
    pagamentos: sumArr(g => g.data.pagamentos),
    inputs: sumArr(g => g.data.inputs),
  };
  const consCells = seriesFor(consData.caixa, consData.receitas, consData.pagamentos, consData.inputs);
  const consNeg = consCells.findIndex(v => v < 0);
  const consOpen = s.fxOpen_cons !== false;
  const consGroup = {
    cd: 'Σ', key: 'cons', name: perEmp.length === 1 ? perEmp[0].name : `Consolidado · ${perEmp.length} empresas`,
    tag: 'Consolidado', open: consOpen,
    toggle: () => this.setState({ fxOpen_cons: !consOpen }),
    chevStyle: `transition:transform .18s;transform:rotate(${consOpen ? 90 : 0}deg)`,
    headStyle: perEmp[0] ? perEmp[0].headStyle : '', headHover: 'background:#F4F4F6',
    tagStyle: 'font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:#E1F7EF;color:#258B6C;white-space:nowrap',
    badge: consNeg >= 0 ? `Saldo consolidado negativo em ${days[consNeg]}` : '',
    badgeStyle: `display:${consNeg >= 0 ? 'inline' : 'none'};font-size:11px;font-weight:600;color:#B45309;background:#FFF0DD;border-radius:20px;padding:3px 9px;white-space:nowrap`,
    semRecStyle: 'display:none', semRecTitle: '',
    lines: buildLines(false, consData, null, true),
  };
  const fxGroups = view === 'Por SPE' ? perEmp : (perEmp.length ? [consGroup] : []);

  const fxCards = [
    { label: `Caixa inicial (${days[0]})`, val: 'R$ ' + f2(sumCaixa), sub: 'Saldos bancários do dia', style: 'display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:100ms', valStyle: 'font-size:20px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums' },
    { label: 'Receitas no período', val: 'R$ ' + f2(sumRec), sub: fxRecSel.length === recAll.length ? 'Todos os tipos' : fxRecSel.join(', '), style: 'display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:150ms', valStyle: 'font-size:20px;font-weight:700;color:#258B6C;font-variant-numeric:tabular-nums' },
    { label: 'Pagamentos + inputs', val: 'R$ ' + f2(-sumPag + sumInputs), sub: 'Títulos Sienge + manuais', style: 'display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:200ms', valStyle: 'font-size:20px;font-weight:700;color:#DC2626;font-variant-numeric:tabular-nums' },
    { label: 'Aportes às SPEs', val: L ? 'R$ ' + f2(L.totalAportes) : 'R$ 3.015.146,57', sub: 'Calculado pelo sistema', style: 'display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:250ms', valStyle: 'font-size:20px;font-weight:700;color:#7C3AED;font-variant-numeric:tabular-nums' },
    { label: `Saldo final (${days[N - 1]})`, val: `R$ ${f2(sumFinal)}`, sub: `${perEmp.length} de ${emps.length} empresas no filtro`, style: 'display:flex;flex-direction:column;gap:7px;padding:15px 17px;border-radius:10px;background:#FFFFFF;box-shadow:0 0 0 1px #EEEEF1;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:300ms', valStyle: `font-size:20px;font-weight:700;color:${sumFinal < 0 ? '#DC2626' : '#111827'};font-variant-numeric:tabular-nums` },
  ];

  const ddFxEmp = { toggle: () => this.setState({ ddOpen: s.ddOpen === 'fxEmp' ? null : 'fxEmp' }), isOpen: s.ddOpen === 'fxEmp', label: `${fxEmpSel.length} selecionadas`, btnStyle: this.mkDropdown('fxEmp', s, '', [], () => {}).btnStyle, chevStyle: `transition:transform .18s;transform:rotate(${s.ddOpen === 'fxEmp' ? 180 : 0}deg)`, panelStyle: this.mkDropdown('fxEmp', s, '', [], () => {}).panelStyle };
  const ddFxRec = { toggle: () => this.setState({ ddOpen: s.ddOpen === 'fxRec' ? null : 'fxRec' }), isOpen: s.ddOpen === 'fxRec', label: fxRecSel.length === recAll.length ? 'Todas' : `${fxRecSel.length} selecionadas`, btnStyle: this.mkDropdown('fxRec', s, '', [], () => {}).btnStyle, chevStyle: `transition:transform .18s;transform:rotate(${s.ddOpen === 'fxRec' ? 180 : 0}deg)`, panelStyle: this.mkDropdown('fxRec', s, '', [], () => {}).panelStyle };
  const chkItem = (sel, label, on, toggle) => ({
    // preventDefault: the list sits inside a <label>, whose activation would re-click the toggle button and close the panel.
    onClick: e => { if (e) { e.stopPropagation?.(); e.preventDefault?.(); } toggle(); },
    style: 'display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;font-size:12.5px;color:#374151;cursor:pointer;transition:background .12s',
    hoverStyle: 'background:#F4F4F6',
    boxStyle: `width:16px;height:16px;border-radius:5px;flex:none;display:flex;align-items:center;justify-content:center;background:${on ? '#4161FF' : '#FFFFFF'};box-shadow:0 0 0 1.5px ${on ? '#4161FF' : '#D8D8E0'};transition:all .15s`,
    checkStyle: `opacity:${on ? 1 : 0};transition:opacity .1s`,
    label,
  });

  const ia = this.live && s.page === 'fluxo' ? this.iaBanner('fluxo', fluxoInsights(this)) : null;
  return {
    ...fluxoCfgVals.call(this),
    iaFluxoHeadline: ia ? ia.headline : 'Saldo projetado fica negativo em 28/09 · R$ 142 mil abaixo do necessário',
    iaFluxoSub: ia ? ia.sub : 'Análise com IA · projeção dos próximos 10 dias',
    isFluxo: s.page === 'fluxo',
    fluxoItemStyle: s.page === 'fluxo' ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997' : subItemStyle,
    goFluxo: e => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'fluxo', module: 'Financeiro', financeiroOpen: true, userMenuOpen: false }); },
    fxSpinStyle: s.fxRecalculating ? 'animation:spin .7s linear infinite' : '',
    fxExport: () => this.toast('Fluxo de caixa exportado · fluxo_caixa.xlsx'),
    fxRecalc: () => { this.setState({ fxRecalculating: true }); setTimeout(() => { this.setState({ fxRecalculating: false }); this.toast('Fluxo recalculado com os dados mais recentes.'); }, 900); },
    fxPeriodLabel: L ? L.periodLabel : '',
    fxDateFrom: P.from,
    fxDateTo: P.to,
    onFxDateFrom: e => {
      const v = e && e.target ? e.target.value : '';
      if (!v) return;
      const to = s.fxDateTo && s.fxDateTo >= v && daysBetween(v, s.fxDateTo) < FLUXO_MAX_DAYS ? s.fxDateTo : addDays(v, 9);
      this.setState({ fxDateFrom: v, fxDateTo: to });
    },
    onFxDateTo: e => {
      const v = e && e.target ? e.target.value : '';
      if (!v) return;
      if (v < P.from) { this.toast('A data final não pode ser anterior à inicial.'); return; }
      if (daysBetween(P.from, v) >= FLUXO_MAX_DAYS) { this.toast(`Período máximo de ${FLUXO_MAX_DAYS} dias.`); return; }
      this.setState({ fxDateTo: v });
    },
    fxGridStyle: `display:grid;grid-template-columns:${gridCols};gap:0;padding:11px 18px;background:#FAFAFB;box-shadow:inset 0 -1px 0 #EEEEF1`,
    fxTableStyle: `min-width:${256 + 104 * N}px`,
    fxViewTabs: ['Consolidado', 'Por SPE'].map(l => ({ label: l, style: `border:none;border-radius:6px;padding:0 12px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${view === l ? '#111827' : 'transparent'};color:${view === l ? '#FFFFFF' : '#64748B'}`, onClick: () => this.setState({ fxView: l }) })),
    ddFxEmp,
    fxSaveDefaultView: () => {
      try { localStorage.setItem('he_fluxo_empresas_default', JSON.stringify(fxEmpSel)); } catch { /* storage blocked */ }
      this.setState({ fxEmpDefault: fxEmpSel.slice() });
      this.toast(`Visão padrão salva \u00b7 ${fxEmpSel.length} de ${emps.length} empresas.`);
    },
    fxSaveViewLabel: fxIsSavedMatch ? 'Visão padrão salva' : 'Salvar como visão padrão',
    fxSaveViewStyle: `display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:8px;border:1px solid ${fxIsSavedMatch ? '#C7EEE0' : '#E7E7EA'};background:${fxIsSavedMatch ? '#E1F7EF' : '#FFFFFF'};color:${fxIsSavedMatch ? '#258B6C' : '#374151'};font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;align-self:flex-end`,
    fxEmpItems: emps.map(e => chkItem(fxEmpSel, e.name, fxEmpSel.includes(e.cd), () => this.setState({ fxEmpSel: fxEmpSel.includes(e.cd) ? fxEmpSel.filter(c => c !== e.cd) : fxEmpSel.concat(e.cd) }))),
    ddFxRec,
    fxRecItems: recAll.map(r => chkItem(fxRecSel, r, fxRecSel.includes(r), () => this.setState({ fxRecSel: fxRecSel.includes(r) ? fxRecSel.filter(x => x !== r) : fxRecSel.concat(r) }))),
    fxCards,
    fxScopeLabel: `${perEmp.length} de ${emps.length} empresas no filtro`,
    fxDayHeaders: days.map((d, i) => ({ date: d, dow: dows[i], style: `text-align:right;padding-right:2px` })),
    fxGroups,
    fxEmptyStyle: `display:${perEmp.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:48px 20px`,
  };
}
