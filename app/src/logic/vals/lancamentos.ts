import type { AppLogic } from '../AppLogic';
import { todayIso, addDays } from '../../lib/api';

export function lancVals(this: AppLogic, subItemStyle: string) {
  const s: any = this.state;
  const today = this.live ? todayIso() : '2026-09-23';
  const all = s.lcRowsData || (this.live ? [] : this.lcSeed());
  const f2 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dLabel = d => { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };
  const empAll = 'Todas as empresas';
  const lcEmp = s.lcEmp || empAll;
  const empNames: any[] = []; all.forEach(a => { if (empNames.indexOf(a.emp) < 0) empNames.push(a.emp); });
  if (this.live) Object.values(this.empresaById()).forEach((e: any) => { if (empNames.indexOf(e.label) < 0) empNames.push(e.label); });
  const from = s.lcFrom || today, to = s.lcTo || (this.live ? addDays(today, 12) : '2026-10-05');
  const tipo = s.lcTipo || 'Todos', sit = s.lcSit || 'Todas';
  const q = (s.lcSearch || '').trim().toLowerCase();
  const filtered = all.filter(a =>
    a.date >= from && a.date <= to &&
    (lcEmp === empAll || a.emp === lcEmp) &&
    (tipo === 'Todos' || (tipo === 'Saídas' ? a.tipo === 'saida' : a.tipo === 'entrada')) &&
    (sit === 'Todas' || (sit === 'Lançado' ? a.sit === 'lancado' : a.sit === 'previsto')) &&
    (!q || `${a.desc} ${a.cat}`.toLowerCase().includes(q)));
  const outs = all.filter(a => a.tipo === 'saida' && a.date >= from && a.date <= to);
  const ins = all.filter(a => a.tipo === 'entrada' && a.date >= from && a.date <= to);
  const totalOut = outs.reduce((t, a) => t + a.value, 0);
  const totalIn = ins.reduce((t, a) => t + a.value, 0);
  const recCount = all.filter(a => a.rec !== 'Nenhuma').length;
  const prevCount = all.filter(a => a.sit === 'previsto').length;
  const seg = on => `border:none;border-radius:6px;padding:0 12px;height:30px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s,color .15s;background:${on ? '#111827' : 'transparent'};color:${on ? '#FFFFFF' : '#64748B'}`;
  const cardBase = 'display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:10px;background:#FFFFFF;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:200ms;transition:transform .2s ease,box-shadow .2s ease;cursor:pointer';
  const hasFilters = q || lcEmp !== empAll || tipo !== 'Todos' || sit !== 'Todas';

  const cats = ['Todas as categorias'].concat(this.lcCats);
  const form = s.lcForm || { id: null, date: s.lcDate || today, emp: empNames[0], cat: this.lcCats[0], value: '', tipo: 'saida', rec: 'Nenhuma', parc: 2, sit: 'lancado' };
  const openFor = a => this.setState({ lcModal: true, lcErr: '', ddOpen: null, lcForm: a ? { id: a.id, date: a.date, emp: a.emp, desc: a.desc, cat: a.cat, value: f2(a.value), tipo: a.tipo, rec: a.rec, parc: a.parc, sit: a.sit } : { id: null, date: today, emp: empNames[0], desc: '', cat: this.lcCats[0], value: '', tipo: 'saida', rec: 'Nenhuma', parc: 2, sit: 'lancado' } });
  const patch = p => this.setState(st => ({ lcForm: Object.assign({}, st.lcForm, p) }));
  const parseBRL = v => { const n = parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };

  const ddLcfEmp = this.mkDropdown('lcfEmp', s, lcEmp, [empAll].concat(empNames), v => this.setState({ lcEmp: v }));
  const ddLcEmp = this.mkDropdown('lcEmp', s, form.emp, empNames, v => patch({ emp: v }));
  const ddLcCat = this.mkDropdown('lcCat', s, form.cat, this.lcCats, v => patch({ cat: v }));
  const ddLcRec = this.mkDropdown('lcRec', s, form.rec, ['Nenhuma', 'Mensal', 'Semanal'], v => patch({ rec: v, parc: v === 'Nenhuma' ? 1 : (form.parc > 1 ? form.parc : 12) }));

  const actBtn = 'width:27px;height:27px;flex:none;border-radius:7px;border:1px solid #EEEEF1;background:#FFFFFF;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s';
  let idx = 0;
  const lcRows = filtered.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(a => {
    const i = idx++;
    const isOut = a.tipo === 'saida';
    const lanc = a.sit === 'lancado';
    return {
      dateLabel: dLabel(a.date), cd: a.cd, emp: a.emp, desc: a.desc, cat: a.cat,
      tipo: isOut ? 'Saída' : 'Entrada',
      tipoStyle: `font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;${isOut ? 'background:#FEE9E9;color:#DC2626' : 'background:#E1F7EF;color:#258B6C'}`,
      valFmt: (isOut ? '−' : '+') + ' ' + f2(a.value),
      valStyle: `text-align:right;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:${isOut ? '#DC2626' : '#258B6C'}`,
      rec: a.rec === 'Nenhuma' ? '—' : `${a.rec} · ${a.parc}x`,
      recIconStyle: `display:${a.rec === 'Nenhuma' ? 'none' : 'inline'}`,
      sit: lanc ? 'Lançado' : 'Previsto',
      sitStyle: `display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;border:none;font-family:inherit;cursor:pointer;color:${lanc ? '#258B6C' : '#B45309'};background:${lanc ? '#E1F7EF' : '#FFF0DD'};border-radius:20px;padding:3px 9px 3px 8px;white-space:nowrap;transition:filter .15s`,
      sitDot: `width:6px;height:6px;border-radius:50%;background:${lanc ? '#43B997' : '#F59E0B'}`,
      toggleSit: () => this.setLc(list => list.map(x => x.id === a.id ? Object.assign({}, x, { sit: x.sit === 'lancado' ? 'previsto' : 'lancado' }) : x)),
      rowStyle: `display:grid;grid-template-columns:96px 190px minmax(220px,1fr) 170px 140px 118px 104px 92px;gap:12px;align-items:center;padding:10px 18px;box-shadow:inset 0 -1px 0 #F4F4F6;transition:background .15s;animation:rowIn .35s ease-out both;animation-delay:${Math.min(i, 16) * 22}ms`,
      edit: () => openFor(a),
      del: () => { this.setLc(list => list.filter(x => x.id !== a.id)); this.toast('Lançamento excluído.'); },
    };
  });

  return {
    isLanc: s.page === 'lancamentos',
    lancItemStyle: s.page === 'lancamentos' ? subItemStyle + ';color:#F5F5F7;font-weight:600;background:rgba(67,185,151,.14);border-color:#43B997' : subItemStyle,
    goLanc: e => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'app', page: 'lancamentos', module: 'Financeiro', financeiroOpen: true, userMenuOpen: false }); },
    lcOutFmt: '− ' + f2(totalOut), lcOutSub: `${outs.length} lançamentos no período`,
    lcInFmt: '+ ' + f2(totalIn), lcInSub: `${ins.length} lançamentos no período`,
    lcRecCount: recCount,
    lcPrevCount: prevCount,
    lcPrevCardStyle: cardBase + ';box-shadow:0 0 0 1px #EEEEF1,0 1px 2px rgba(0,0,0,.03)',
    lcFilterPrev: () => this.setState({ lcSit: s.lcSit === 'Previsto' ? 'Todas' : 'Previsto' }),
    lcFrom: from, onLcFrom: e => this.setState({ lcFrom: e.target.value }),
    lcTo: to, onLcTo: e => this.setState({ lcTo: e.target.value }),
    ddLcfEmp,
    lcTipoTabs: ['Todos', 'Saídas', 'Entradas'].map(l => ({ label: l, style: seg(tipo === l), onClick: () => this.setState({ lcTipo: l }) })),
    lcSitTabs: ['Todas', 'Lançado', 'Previsto'].map(l => ({ label: l, style: seg(sit === l), onClick: () => this.setState({ lcSit: l }) })),
    lcSearch: s.lcSearch || '', onLcSearch: e => this.setState({ lcSearch: e.target.value }),
    lcClearStyle: `display:${hasFilters ? 'inline-flex' : 'none'};align-items:center;height:36px;padding:0 13px;border-radius:8px;border:1px solid #E7E7EA;background:#FFFFFF;color:#4161FF;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;animation:popIn .18s ease-out both`,
    lcClearFilters: () => this.setState({ lcSearch: '', lcEmp: empAll, lcTipo: 'Todos', lcSit: 'Todas' }),
    lcRows,
    lcEmptyStyle: `display:${filtered.length ? 'none' : 'flex'};flex-direction:column;align-items:center;gap:6px;padding:48px 20px`,
    lcFooterLabel: `${filtered.length} lançamentos`,
    lcTotalFmt: f2(filtered.reduce((t, a) => t + (a.tipo === 'saida' ? -a.value : a.value), 0)),
    lcTotalStyle: `text-align:right;font-size:14px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums`,
    lcExport: () => (this.live ? this.exportLancCsv(filtered) : this.toast('Lançamentos exportados · lancamentos.xlsx')),
    lcOpenNew: () => openFor(null),
    lcOverlayStyle: `display:${s.lcModal ? 'flex' : 'none'};position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:28px;background:rgba(9,10,16,.5);backdrop-filter:blur(3px);animation:overlayIn .18s ease-out both`,
    lcClose: () => this.setState({ lcModal: false, lcForm: null, lcErr: '', ddOpen: null }),
    lcModalTitle: form.id ? 'Editar lançamento' : 'Novo lançamento',
    lcFTipoTabs: [['saida', 'Saída'], ['entrada', 'Entrada']].map(([k, l]) => ({ label: l, style: seg(form.tipo === k), onClick: () => patch({ tipo: k }) })),
    lcF: form,
    onLcFDate: e => patch({ date: e.target.value }),
    ddLcEmp, ddLcCat, ddLcRec,
    onLcFDesc: e => patch({ desc: e.target.value }),
    onLcFValue: e => patch({ value: e.target.value.replace(/[^\d,.-]/g, '') }),
    lcParcWrapStyle: `display:${form.rec === 'Nenhuma' ? 'none' : 'flex'};flex-direction:column;gap:6px`,
    onLcFParc: e => patch({ parc: parseInt(e.target.value) || 2 }),
    lcFSitTabs: [['lancado', 'Lançado'], ['previsto', 'Previsto']].map(([k, l]) => ({ label: l, style: seg(form.sit === k), onClick: () => patch({ sit: k }) })),
    lcErr: s.lcErr || '',
    lcErrStyle: `display:${s.lcErr ? 'flex' : 'none'};align-items:center;gap:8px;padding:10px 12px;border-radius:9px;background:#FEE9E9;border:1px solid #FCA5A5;color:#DC2626;font-size:12.5px;animation:popIn .18s ease-out both`,
    lcSave: () => {
      const v = parseBRL(form.value);
      if (!form.desc.trim()) { this.setState({ lcErr: 'Informe a descrição.' }); return; }
      if (v == null) { this.setState({ lcErr: 'Informe um valor válido.' }); return; }
      const cd = this.live
        ? Number((Object.values(this.empresaById()).find((e: any) => e.label === form.emp) as any)?.id || 0)
        : (all.find(x => x.emp === form.emp) || {}).cd || 0;
      const rec = { date: form.date, cd, emp: form.emp, desc: form.desc, cat: form.cat, tipo: form.tipo, value: v, rec: form.rec, parc: form.rec === 'Nenhuma' ? 1 : form.parc, sit: form.sit };
      if (form.id) { this.setLc(list => list.map(x => x.id === form.id ? Object.assign({}, x, rec) : x)); this.toast('Lançamento atualizado.'); }
      else { this.setLc(list => [Object.assign({ id: 'lc' + Date.now() }, rec)].concat(list)); this.toast('Lançamento cadastrado.'); }
      this.setState({ lcModal: false, lcForm: null, lcErr: '' });
    },
  };
}
