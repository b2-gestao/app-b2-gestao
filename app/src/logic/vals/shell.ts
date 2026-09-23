import type { AppLogic } from '../AppLogic';
import { dashSource } from './dashboardData';

export function renderVals(this: AppLogic) {
  const s: any = this.state;
  const c = s.collapsed;

  const navItemStyle = "display:flex;flex:none;align-items:center;gap:12px;padding:8px 7px;cursor:pointer;overflow:hidden;border-radius:8px;border:1px solid transparent;transition:border-color .18s ease,box-shadow .18s ease";
  const navItemActiveStyle = navItemStyle + ";background:#4161FF;border-color:#4161FF;box-shadow:0 4px 12px rgba(65,97,255,.22)";
  const navLabelStyle = `font-size:13px;white-space:nowrap;opacity:${c ? 0 : 1};max-width:${c ? '0px' : '160px'};transition:opacity .12s,max-width .18s;overflow:hidden`;
  const subItemStyle = "display:block;padding:6px 10px;font-size:12.5px;color:#A1A1AA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:6px;border-width:1px;border-style:solid;border-color:transparent;background:transparent;transition:border-color .18s ease,color .18s ease";
  const sectionLabelStyle = `flex:none;font-size:10px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:#71717a;padding:14px 9px 4px;white-space:nowrap;overflow:hidden;display:${c ? 'none' : 'block'}`;

  // Live mode swaps the prototype's sample figures for Supabase data (same shapes).
  const D = this.live ? dashSource.call(this) : null;
  const pdata = (D ? D.periodsData : this.periodsData)[s.period];
  const maxVal = Math.max(...pdata.data.flatMap(d => [d.in, d.out]));
  const niceMax = this.niceCeil(maxVal * 1.08);
  const ticksN = 4;
  const yTicks = Array.from({ length: ticksN + 1 }, (_, i) => {
    const val = niceMax * i / ticksN;
    return { value: val, label: val >= 1000 ? `R$ ${Math.round(val / 1000)}k` : `R$ ${Math.round(val)}`, topPct: 100 - (i / ticksN * 100) };
  });

  const ringStyle = (color, pct) => `position:absolute;left:50%;bottom:-4px;transform:translateX(-50%);width:26px;height:calc(${pct}% + 8px);border-radius:5px;overflow:hidden;pointer-events:none;background-image:linear-gradient(90deg,${color} 50%,transparent 50%),linear-gradient(90deg,${color} 50%,transparent 50%),linear-gradient(0deg,${color} 50%,transparent 50%),linear-gradient(0deg,${color} 50%,transparent 50%);background-repeat:repeat-x,repeat-x,repeat-y,repeat-y;background-size:10px 2px,10px 2px,2px 10px,2px 10px;background-position:0 0,0 100%,0 0,100% 0;animation:marchRing .55s linear infinite`;

  const bars = pdata.data.map((d, i) => {
    const inHovered = s.hoverKey === i + ':in';
    const outHovered = s.hoverKey === i + ':out';
    const inPct = s.chartMounted ? (d.in / niceMax * 100) : 0;
    const outPct = s.chartMounted ? (d.out / niceMax * 100) : 0;
    const baseIn = "width:18px;border-radius:3px 3px 0 0;background:#4161FF;position:relative;z-index:1;transition:height .6s cubic-bezier(.16,1,.3,1),filter .15s,transform .15s;transition-delay:" + (i * 30) + "ms";
    const baseOut = "width:18px;border-radius:3px 3px 0 0;background:#43B997;position:relative;z-index:1;transition:height .6s cubic-bezier(.16,1,.3,1),filter .15s,transform .15s;transition-delay:" + (i * 30) + "ms";
    return {
      x: d.x,
      inHovered, outHovered,
      inFmt: this.fmtBRL(d.in),
      outFmt: this.fmtBRL(d.out),
      inEnter: () => this.setState({ hoverKey: i + ':in' }),
      outEnter: () => this.setState({ hoverKey: i + ':out' }),
      clearHover: () => this.setState({ hoverKey: null }),
      inBarStyle: `${baseIn};height:${inPct}%;transform:${inHovered ? 'scaleY(1.015)' : 'none'};transform-origin:bottom;filter:${inHovered ? 'brightness(1.1) drop-shadow(0 4px 10px rgba(65,97,255,.35))' : 'none'}`,
      outBarStyle: `${baseOut};height:${outPct}%;transform:${outHovered ? 'scaleY(1.015)' : 'none'};transform-origin:bottom;filter:${outHovered ? 'brightness(1.08) drop-shadow(0 4px 10px rgba(67,185,151,.35))' : 'none'}`,
      inRingStyle: ringStyle('#7C93FF', inPct),
      outRingStyle: ringStyle('#6FE3C4', outPct),
      inTipStyle: `position:absolute;bottom:calc(${inPct}% + 14px);left:50%;transform:translateX(-50%);background:#111827;color:#FFFFFF;padding:6px 10px;border-radius:7px;font-size:11px;white-space:nowrap;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:5;pointer-events:none;animation:tooltipIn .12s ease-out`,
      outTipStyle: `position:absolute;bottom:calc(${outPct}% + 14px);left:50%;transform:translateX(-50%);background:#111827;color:#FFFFFF;padding:6px 10px;border-radius:7px;font-size:11px;white-space:nowrap;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:5;pointer-events:none;animation:tooltipIn .12s ease-out`,
    };
  });

  const periodButtons = this.periodDefs.map(pd => {
    const active = pd.key === s.period;
    return {
      key: pd.key,
      label: pd.label,
      onClick: () => this.setState({ period: pd.key, hoverKey: null }),
      style: `border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s,color .15s;background:${active ? '#111827' : 'transparent'};color:${active ? '#FFFFFF' : '#64748B'}`,
    };
  });

  // ---- custo financeiro (pago / juros / desconto) ----
  const finRows = D ? pdata.data.map(d => ({ x: d.x, pago: d.pago, juros: d.juros, desc: d.desc })) : pdata.data.map((d, i) => {
    const pago = d.out;
    const juros = Math.round(pago * (0.018 + ((i * 37) % 13) / 900));
    const desc = Math.round(pago * (0.03 + ((i * 53) % 17) / 800));
    return { x: d.x, pago, juros, desc };
  });
  const nPts = finRows.length;
  const totPago = finRows.reduce((a, r) => a + r.pago, 0);
  const totJuros = finRows.reduce((a, r) => a + r.juros, 0);
  const totDesc = finRows.reduce((a, r) => a + r.desc, 0);
  const maxPago = this.niceCeil(Math.max(...finRows.map(r => r.pago)) * 1.15);
  const maxSec = this.niceCeil(Math.max(...finRows.map(r => Math.max(r.juros, r.desc))) * 1.3);
  const PX = i => nPts <= 1 ? 300 : 40 + i * (540 / (nPts - 1));
  const PY = (v, mx) => 158 - (v / mx) * 126;
  const mk = (key, mx) => finRows.map((r, i) => (i ? 'L' : 'M') + PX(i).toFixed(1) + ' ' + PY(r[key], mx).toFixed(1)).join(' ');
  const pathPago = mk('pago', maxPago);
  const pathJuros = mk('juros', maxSec);
  const pathDesc = mk('desc', maxSec);
  const areaPago = nPts > 1 ? `${pathPago} L ${PX(nPts - 1).toFixed(1)} 158 L ${PX(0).toFixed(1)} 158 Z` : '';
  const linePts: any[] = [];
  finRows.forEach((r, i) => {
    linePts.push({ cx: PX(i), cy: PY(r.pago, maxPago), color: '#4161FF', r: s.lineHover === i ? 5 : 3.2 });
    linePts.push({ cx: PX(i), cy: PY(r.juros, maxSec), color: '#F59E0B', r: s.lineHover === i ? 5 : 3.2 });
    linePts.push({ cx: PX(i), cy: PY(r.desc, maxSec), color: '#43B997', r: s.lineHover === i ? 5 : 3.2 });
  });
  const colW = 100 / nPts;
  const lineCols = finRows.map((r, i) => {
    const on = s.lineHover === i;
    return {
      x: r.x,
      pagoFmt: this.fmtBRL(r.pago), jurosFmt: this.fmtBRL(r.juros), descFmt: this.fmtBRL(r.desc),
      enter: () => this.setState({ lineHover: i }),
      leave: () => this.setState({ lineHover: null }),
      colStyle: `position:absolute;top:0;bottom:0;left:${i * colW}%;width:${colW}%;cursor:crosshair`,
      guideStyle: `position:absolute;top:6px;bottom:0;left:50%;width:1px;background:linear-gradient(#4161FF,rgba(65,97,255,0));opacity:${on ? 1 : 0};transition:opacity .15s`,
      tipStyle: `position:absolute;left:50%;top:2px;transform:translateX(-50%);background:#111827;color:#FFFFFF;border-radius:8px;padding:8px 10px;font-size:11px;line-height:1.6;white-space:nowrap;box-shadow:0 12px 28px rgba(0,0,0,.22);pointer-events:none;z-index:6;opacity:${on ? 1 : 0};transition:opacity .12s,transform .12s`,
      labelStyle: `flex:1;text-align:center;font-size:11px;color:${on ? '#111827' : '#94A3B8'};font-weight:${on ? 600 : 400};transition:color .15s`,
    };
  });

  // ---- empresas / grupos ----
  const empSrc = D ? D.empresas : this.empresas;
  const grupoOrder = D ? D.grupoOrder : this.grupoOrder;
  const grupoColors = D ? D.grupoColors : this.grupoColors;
  const escala = D ? 1 : (this.periodFactor[s.period] || 1);
  const empTotals = empSrc.map(e => ({
    n: e.n, s: e.s, c: e.c,
    total: Object.keys(e.g).reduce((a, k) => a + e.g[k], 0) * escala,
  })).sort((a, b) => b.total - a.total);
  const maxEmp = empTotals[0] ? empTotals[0].total : 1;
  const empRanking = empTotals.map((e, i) => {
    const sel = s.selectedEmpresa === e.n;
    const dim = s.selectedEmpresa && !sel;
    return {
      n: e.n, initials: e.s, rank: i + 1,
      valueFmt: this.fmtK(e.total),
      onClick: () => this.setState(st => ({ selectedEmpresa: st.selectedEmpresa === e.n ? null : e.n })),
      rowStyle: `display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:9px;cursor:pointer;border:1px solid ${sel ? e.c : 'transparent'};background:${sel ? e.c + '12' : 'transparent'};opacity:${dim ? .45 : 1};transition:background .18s,border-color .18s,opacity .18s,transform .18s;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${300 + i * 45}ms`,
      chipStyle: `width:26px;height:26px;flex:none;border-radius:7px;background:${e.c}18;color:${e.c};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;letter-spacing:.02em`,
      barStyle: `height:4px;border-radius:2px;background:${e.c};width:${(e.total / maxEmp * 100).toFixed(1)}%;transition:width .7s cubic-bezier(.16,1,.3,1)`,
    };
  });

  const src = s.selectedEmpresa ? empSrc.filter(e => e.n === s.selectedEmpresa) : empSrc;
  let grupoRaw = grupoOrder.map(g => ({
    name: g,
    value: src.reduce((a, e) => a + (e.g[g] || 0), 0) * escala,
    color: grupoColors[g],
  }));
  if ((this.props.groupSort ?? 'Valor') === 'Valor') grupoRaw = grupoRaw.slice().sort((a, b) => b.value - a.value);
  const maxGrupo = Math.max(...grupoRaw.map(g => g.value), 1);
  const anySel = s.selectedGrupos.length > 0;
  const grupoRows = grupoRaw.map((g, i) => {
    const on = s.selectedGrupos.indexOf(g.name) >= 0;
    const dim = anySel && !on;
    return {
      name: g.name,
      valueFmt: this.fmtK(g.value),
      pctFmt: (grupoRaw.reduce((a, x) => a + x.value, 0) ? g.value / grupoRaw.reduce((a, x) => a + x.value, 0) * 100 : 0).toFixed(1).replace('.', ',') + '%',
      onClick: () => this.setState(st => ({
        selectedGrupos: st.selectedGrupos.indexOf(g.name) >= 0
          ? st.selectedGrupos.filter(x => x !== g.name)
          : st.selectedGrupos.concat([g.name]),
      })),
      rowStyle: `display:grid;grid-template-columns:158px minmax(0,1fr) 86px;align-items:center;gap:14px;padding:9px 10px;border-radius:9px;cursor:pointer;border:1px solid ${on ? g.color : 'transparent'};background:${on ? g.color + '0F' : 'transparent'};opacity:${dim ? .38 : 1};transition:all .2s ease`,
      nameStyle: `display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:${on ? 600 : 500};color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
      dotStyle: `width:9px;height:9px;flex:none;border-radius:3px;background:${g.color};box-shadow:${on ? '0 0 0 3px ' + g.color + '33' : 'none'};transition:box-shadow .2s`,
      barStyle: `height:14px;border-radius:4px;background:linear-gradient(90deg,${g.color},${g.color}B0);width:${s.chartMounted ? (g.value / maxGrupo * 100).toFixed(1) : 0}%;transition:width .8s cubic-bezier(.16,1,.3,1);transition-delay:${i * 60}ms;box-shadow:${on ? '0 4px 14px ' + g.color + '55' : 'none'}`,
      valueStyle: `text-align:right;font-size:12.5px;font-weight:600;color:${on ? g.color : '#374151'};font-variant-numeric:tabular-nums`,
    };
  });
  const selTotal = anySel
    ? grupoRaw.filter(g => s.selectedGrupos.indexOf(g.name) >= 0).reduce((a, g) => a + g.value, 0)
    : grupoRaw.reduce((a, g) => a + g.value, 0);

  // ---- resumo de IA ----
  const tone = this.props.aiTone ?? 'Executivo';
  const topGrupo = (grupoRaw.slice().sort((a, b) => b.value - a.value)[0] || { name: '—' }).name;
  const due = D ? { count: D.dueTodayCount, value: D.dueTodayValue, next10: D.next10Count } : undefined;
  const resumo = this.buildResumo(tone, totPago, totJuros, totDesc, (empTotals[0] || { n: '—' }).n, topGrupo, pdata.label, due);
  const aiWords = resumo.split(' ').map((w, i) => ({
    w,
    style: `display:inline-block;margin-right:.3em;opacity:0;animation:${s.aiVariant % 2 ? 'wordIn2' : 'wordIn'} .45s ease-out both;animation-delay:${120 + i * 18}ms`,
  }));
  const mkChip = i => `display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:9px;border:1px solid #EEEEF1;background:#FAFAFB;min-width:132px;cursor:default;transition:transform .18s ease,border-color .18s ease;opacity:0;animation:fadeInUp .45s ease-out both;animation-delay:${340 + i * 70}ms`;
  const aiChips = [
    { label: 'Total pago', value: this.fmtK(totPago), color: '#4161FF', style: mkChip(0) },
    { label: 'Juros', value: this.fmtK(totJuros), color: '#D97706', style: mkChip(1) },
    { label: 'Descontos', value: this.fmtK(totDesc), color: '#35AD88', style: mkChip(2) },
    { label: 'Vencendo em 7d', value: D ? D.vencendo7Label : '4 parcelas', color: '#EF4444', style: mkChip(3) },
  ];

  const parcelaCards = (D ? D.parcelas : this.parcelas).map((p, i) => ({
    d: p.d, m: p.m, wd: p.wd, emp: p.emp, desc: p.desc, st: p.st,
    valueFmt: this.fmtBRL(p.v),
    cardStyle: `position:relative;flex:none;width:212px;padding:14px;border-radius:11px;background:#FFFFFF;border:1px solid ${p.urgent ? '#FCA5A5' : '#EEEEF1'};box-shadow:0 1px 2px rgba(0,0,0,.03);cursor:pointer;opacity:0;animation:fadeInUp .5s ease-out both;animation-delay:${260 + i * 55}ms;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease`,
    cardHover: `transform:translateY(-4px);border-color:${p.tone};box-shadow:0 12px 26px ${p.tone}22`,
    nodeStyle: `position:absolute;top:-14px;left:16px;width:11px;height:11px;border-radius:50%;background:${p.tone};box-shadow:0 0 0 3px #FFFFFF,0 0 0 4px ${p.tone}44;animation:${p.urgent ? 'pulseNode 1.8s ease-in-out infinite' : 'none'}`,
    dateStyle: `font-size:20px;font-weight:700;color:#111827;line-height:1`,
    tagStyle: `display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:${p.tone}14;color:${p.tone}`,
  }));

  const ringBase = "border:1.5px solid transparent;border-radius:13.5px;cursor:pointer;backdrop-filter:blur(12px);background:linear-gradient(rgba(24,26,40,.97),rgba(24,26,40,.97)) padding-box,linear-gradient(rgba(245,245,247,.16),rgba(245,245,247,.16)) border-box;box-shadow:0 10px 30px rgba(0,0,0,.28);will-change:transform;transition:transform .45s cubic-bezier(.16,.84,.28,1),box-shadow .45s ease";
  const tileStyle = "display:flex;flex-direction:column;gap:7px;height:100%;padding:13px;opacity:0;animation:tileIn .42s ease-out both";
  const mkTile = (it, i) => ({
    ...it,
    ringStyle: ringBase,
    tileStyle: tileStyle + `;animation-delay:${60 + i * 34}ms`,
    chipStyle: `width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:${it.c}22;border:1px solid ${it.c}55`,
    open: () => this.setState({
      view: 'app', module: it.name, collapsed: false,
      page: it.name === 'Configurações' ? (['usuarios', 'departamentos', 'perfis'].find(p => this.pode(this.pagePerm[p])) || 'dashboard') : 'dashboard',
      configOpen: it.name === 'Configurações' ? true : this.state.configOpen,
    }),
  });
  const showWeather = this.props.showWeather !== false;
  const showIndicators = this.props.showIndicators !== false;
  const indicators = this.econIndicators.map((ind, i) => ({
    ...ind,
    value: this.live ? ((s.econValues || {})[ind.label] || '…') : ind.value,
    wrapStyle: `display:flex;flex-direction:column;gap:2px;padding:2px 11px;white-space:nowrap;background:${i > 0 ? 'linear-gradient(to bottom,transparent,rgba(245,245,247,.16) 20%,rgba(245,245,247,.16) 80%,transparent) no-repeat left/1px 100%' : 'none'}`,
  }));
  const homeBg = s.bgMode === 'image'
    ? `#161826 url("${s.bgUrl}") center/cover no-repeat`
    : s.bgColor;

  // Menus the signed-in profile cannot view are hidden (app_perfis.permissoes).
  const hide = (style: string, page: string) => (this.pode(this.pagePerm[page]) ? style : style + ';display:none');
  const pageVals: any = {
    ...this.usersVals(subItemStyle),
    ...this.deptsVals(),
    ...this.perfisVals(subItemStyle),
    ...this.saldosVals(subItemStyle),
    ...this.lancVals(subItemStyle),
    ...this.progVals(subItemStyle),
    ...this.fluxoVals(subItemStyle),
  };
  for (const [key, page] of [['usuariosItemStyle', 'usuarios'], ['departamentosItemStyle', 'departamentos'], ['perfisItemStyle', 'perfis'],
    ['saldosItemStyle', 'saldos'], ['lancItemStyle', 'lancamentos'], ['progItemStyle', 'programacao'], ['fluxoItemStyle', 'fluxo']]) {
    pageVals[key] = hide(pageVals[key], page);
  }

  return {
    ...pageVals,
    ...this.identityVals(),
    isHome: s.view === 'home',
    dateLabel: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    expanded: !c,
    crumbLabel: (s.page === 'usuarios' || s.page === 'departamentos' || s.page === 'perfis') ? 'Configurações' : (['saldos', 'lancamentos', 'programacao', 'fluxo'].includes(s.page) ? 'Financeiro' : (s.module === 'Painel' ? 'Painel' : s.module)),
    pageTitle: s.page === 'usuarios' ? 'Usuários' : (s.page === 'departamentos' ? 'Departamentos' : (s.page === 'perfis' ? 'Perfis' : (s.page === 'saldos' ? 'Saldos bancários' : (s.page === 'lancamentos' ? 'Lançamentos manuais' : (s.page === 'programacao' ? 'Programação do dia' : (s.page === 'fluxo' ? 'Fluxo de caixa' : 'Visão Geral')))))),
    goHome: () => this.setState({ view: 'home', page: 'dashboard', userMenuOpen: false }),
    homeShellStyle: `position:relative;height:100vh;width:100%;overflow:hidden;background:${homeBg}`,
    scrimStyle: s.bgMode === 'image'
      ? 'position:absolute;inset:0;background:linear-gradient(100deg,rgba(9,10,16,.74) 0%,rgba(9,10,16,.46) 46%,rgba(9,10,16,.12) 100%)'
      : 'position:absolute;inset:0;background:linear-gradient(100deg,rgba(9,10,16,.34) 0%,rgba(9,10,16,.2) 100%)',
    appShellStyle: `display:${s.view === 'app' ? 'flex' : 'none'};height:100vh;width:100%;overflow:hidden`,
    operacao: this.homeModules.operacao.map(mkTile),
    cadastros: this.homeModules.cadastros.map((it, i) => mkTile(it, i + 9)),
    showWeatherChip: showWeather,
    showIndicators, indicators,
    isSun: showWeather && s.wkind === 'sun',
    isHeat: showWeather && s.wkind === 'heat',
    isRain: showWeather && s.wkind === 'rain',
    isCloud: showWeather && s.wkind === 'cloud',
    tempLabel: s.temp == null ? '--°' : s.temp + '°C',
    weatherLabel: s.wlabel || '—',
    placeLabel: s.place,
    bgIsImage: s.bgMode === 'image',
    bgIsColor: s.bgMode === 'color',
    toggleBgMode: () => this.saveBg({ bgMode: s.bgMode === 'image' ? 'color' : 'image' }),
    switchTrackStyle: `width:34px;height:19px;flex:none;border-radius:10px;cursor:pointer;position:relative;transition:background .18s ease;background:${s.bgMode === 'image' ? '#4161FF' : 'rgba(245,245,247,.22)'}`,
    switchKnobStyle: `position:absolute;top:2.5px;left:${s.bgMode === 'image' ? '17.5px' : '2.5px'};width:14px;height:14px;border-radius:50%;background:#FFFFFF;transition:left .18s ease`,
    swatches: this.bgSwatches.map(sw => ({
      name: sw.name,
      style: `width:18px;height:18px;border-radius:6px;cursor:pointer;background:${sw.v};border:${s.bgColor === sw.v ? '2px solid #4161FF' : '1px solid rgba(245,245,247,.3)'}`,
      pick: () => this.saveBg({ bgColor: sw.v }),
    })),
    onPickBg: (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => this.saveBg({ bgUrl: r.result, bgMode: 'image' });
      r.readAsDataURL(f);
    },

    collapsed: c,

    finTotPagoFmt: this.fmtBRL(totPago),
    finTotJurosFmt: this.fmtBRL(totJuros),
    finTotDescFmt: this.fmtBRL(totDesc),
    jurosPctFmt: (totPago ? totJuros / totPago * 100 : 0).toFixed(1).replace('.', ',') + '% do valor pago',
    descPctFmt: (totPago ? totDesc / totPago * 100 : 0).toFixed(1).replace('.', ',') + '% de economia',
    jurosBarStyle: `height:100%;border-radius:99px;background:linear-gradient(90deg,#F59E0B,#FBBF24);width:${s.chartMounted ? Math.min(100, totPago ? totJuros / totPago * 100 * 12 : 0).toFixed(0) : 0}%;transition:width .9s cubic-bezier(.16,1,.3,1)`,
    descBarStyle: `height:100%;border-radius:99px;background:linear-gradient(90deg,#43B997,#6FE3C4);width:${s.chartMounted ? Math.min(100, totPago ? totDesc / totPago * 100 * 12 : 0).toFixed(0) : 0}%;transition:width .9s cubic-bezier(.16,1,.3,1);transition-delay:.1s`,
    lineSubtitle: `Pago, juros e descontos · ${pdata.sub.split('·')[1] ? pdata.sub.split('·')[1].trim() : pdata.label}`,
    pathPago, pathJuros, pathDesc, areaPago, linePts, lineCols,
    lineDrawKey: s.period,

    parcelaCards,

    empRanking,
    empFilterLabel: s.selectedEmpresa ? s.selectedEmpresa : 'Todas as empresas',
    empClearStyle: `display:${s.selectedEmpresa ? 'inline-flex' : 'none'};align-items:center;gap:5px;font-size:11px;color:#4161FF;background:#EAF1FF;border:none;border-radius:20px;padding:3px 10px;cursor:pointer`,
    clearEmpresa: () => this.setState({ selectedEmpresa: null }),

    grupoRows,
    grupoTotalFmt: this.fmtBRL(selTotal),
    grupoTotalLabel: anySel ? 'Total dos segmentos destacados' : 'Total de todos os segmentos',
    grupoClearStyle: `display:${anySel ? 'inline-flex' : 'none'};align-items:center;gap:5px;font-size:11px;color:#4161FF;background:#EAF1FF;border:none;border-radius:20px;padding:4px 11px;cursor:pointer`,
    clearGrupos: () => this.setState({ selectedGrupos: [] }),

    aiWords, aiChips,

    asideStyle: `width:${c ? '68px' : '252px'};flex:none;background:#080808;display:flex;flex-direction:column;height:100%;transition:width .18s ease;overflow:hidden`,
    labelBlockStyle: `display:${c ? 'none' : 'flex'};flex-direction:column;gap:1px`,
    toggleJustify: c ? 'center' : 'flex-start',
    toggleSidebar: () => this.setState(st => ({ collapsed: !st.collapsed })),

    navItemStyle, navItemActiveStyle, navLabelStyle, subItemStyle, sectionLabelStyle,

    toggleFinanceiro: () => this.setState(st => ({ financeiroOpen: !st.financeiroOpen })),
    toggleRh: () => this.setState(st => ({ rhOpen: !st.rhOpen })),
    togglePermutas: () => this.setState(st => ({ permutasOpen: !st.permutasOpen })),
    toggleVendas: () => this.setState(st => ({ vendasOpen: !st.vendasOpen })),
    toggleConfig: () => this.setState(st => ({ configOpen: !st.configOpen })),

    financeiroChevron: (!c && s.financeiroOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    rhChevron: (!c && s.rhOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    permutasChevron: (!c && s.permutasOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    vendasChevron: (!c && s.vendasOpen) ? 'rotate(180deg)' : 'rotate(0deg)',
    configChevron: (!c && s.configOpen) ? 'rotate(180deg)' : 'rotate(0deg)',

    financeiroContentStyle: `display:grid;grid-template-rows:${(!c && s.financeiroOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    rhContentStyle: `display:grid;grid-template-rows:${(!c && s.rhOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    permutasContentStyle: `display:grid;grid-template-rows:${(!c && s.permutasOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    vendasContentStyle: `display:grid;grid-template-rows:${(!c && s.vendasOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,
    configContentStyle: `display:grid;grid-template-rows:${(!c && s.configOpen) ? '1fr' : '0fr'};transition:grid-template-rows .16s ease`,

    toggleUserMenu: () => this.setState(st => ({ userMenuOpen: !st.userMenuOpen })),
    userPopoverStyle: `display:${s.userMenuOpen ? 'flex' : 'none'};flex-direction:column;position:absolute;bottom:100%;left:10px;right:10px;margin-bottom:6px;background:#0D0D0F;border-radius:8px;box-shadow:0 0 0 1px #202024,0 16px 40px rgba(0,0,0,.5);padding:4px;z-index:20`,

    kpiReceberFmt: this.fmtBRL((D ? D.targets : this.targets).receber),
    kpiPagarFmt: this.fmtBRL((D ? D.targets : this.targets).pagar),
    kpiSaldoFmt: this.fmtBRL((D ? D.targets : this.targets).saldo),
    kpiPrevisaoFmt: this.fmtBRL((D ? D.targets : this.targets).previsao),
    kpiReceberDelta: D ? D.kpiReceberDelta : '↑ 6,4% vs. ontem',
    kpiPagarDelta: D ? D.kpiPagarDelta : '↓ 2,1% vs. ontem',
    kpiSaldoSub: D ? D.kpiSaldoSub : '↑ 4 movimentações hoje',
    kpiPrevisaoSub: D ? D.kpiPrevisaoSub : '18 lançamentos previstos',
    parcelasTodayLabel: D ? D.parcelasTodayLabel : '1 parcela vence hoje',

    chartTitle: `Fluxo de Caixa ${pdata.label}`,
    chartSub: pdata.sub,
    periodButtons,
    yTicks,
    bars,

    skeletonWrapStyle: `display:${s.aiLoading ? 'flex' : 'none'};flex-direction:column;gap:8px;margin-top:12px`,
    textWrapStyle: `opacity:${s.aiLoading ? 0 : 1};transition:opacity .35s ease;transition-delay:${s.aiLoading ? '0s' : '.1s'}`,
    insightText: this.buildInsight(pdata, s.aiVariant),
    aiIconStyle: 'transition:opacity .2s',
    aiRefreshIconStyle: `animation:${s.aiLoading ? 'spin .9s linear infinite' : 'none'};transform-origin:center`,
    refreshInsight: () => {
      this.setState({ aiLoading: true });
      setTimeout(() => this.setState(st => ({ aiLoading: false, aiVariant: (st.aiVariant + 1) % 3 })), 900);
    },
  };
}
