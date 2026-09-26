import type { AppLogic } from './AppLogic';
import type { RelatorioIaProg } from '../lib/relatorioIaPdf';
import { todayIso } from '../lib/api';
import { progLiveGroups } from './vals/programacaoData';
import { fluxoLive } from './vals/fluxoData';

// Rule-based insights over the live data, shown in the "Análise com IA" banner and
// panel of Programação do dia and Fluxo de caixa. Each item: [label, text, color, action?].

type Item = { label: string; text: string; color: string; action?: string; go?: () => void };
const brl = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const brlK = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi` : Math.abs(v) >= 1e3 ? `R$ ${Math.round(v / 1e3)} mil` : brl(v));

export function progInsights(app: AppLogic) {
  const { groups, loading } = progLiveGroups.call(app);
  const sel: string[] | undefined = app.state.pgEmpSel;
  const gs = sel ? groups.filter((g: any) => sel.includes(g.emp)) : groups;
  const items: Item[] = [];

  const short = gs
    .map((g: any) => ({ g, falta: g.items.filter((i: any) => i.on).reduce((t: number, i: any) => t + i.val, 0) - g.saldo }))
    .filter(x => x.falta > 0)
    .sort((a, b) => b.falta - a.falta);
  if (short.length) {
    const total = short.reduce((t, x) => t + x.falta, 0);
    items.push({
      label: 'Saldo insuficiente',
      text: short.length === 1
        ? `${short[0].g.emp} não tem saldo inicial para cobrir os pagamentos do período — faltam ${brl(short[0].falta)}.`
        : `${short.length} empresas não têm saldo inicial para cobrir os pagamentos do período — faltam ${brl(total)} no total. A maior necessidade é ${short[0].g.emp}, com ${brl(short[0].falta)}.`,
      color: '#EF4444', action: 'Ver saldos bancários', go: () => app.goSaldosFromIa(),
    });
  }

  const all = gs.flatMap((g: any) => g.items.filter((i: any) => i.on && i.tag === 'Título').map((i: any) => ({ ...i, emp: g.emp })));
  if (all.length >= 3) {
    const avg = all.reduce((t: number, i: any) => t + i.val, 0) / all.length;
    const top = all.slice().sort((a: any, b: any) => b.val - a.val)[0];
    if (top.val >= 3 * avg) {
      items.push({
        label: 'Pagamento fora do padrão',
        text: `O título de ${top.title} (${top.emp}) de ${brl(top.val)} é ${(top.val / avg).toFixed(1).replace('.', ',')}x a média dos títulos do período.`,
        color: '#F59E0B',
      });
    }
  }

  const semAut = all.filter((i: any) => i.authorized === false);
  if (semAut.length) {
    items.push({
      label: 'Títulos sem autorização',
      text: `${semAut.length} ${semAut.length === 1 ? 'título ainda não está autorizado' : 'títulos ainda não estão autorizados'} no Sienge, somando ${brl(semAut.reduce((t: number, i: any) => t + i.val, 0))}.`,
      color: '#94A3B8',
    });
  }

  const headline = loading ? 'Carregando a programação…'
    : items.length ? items[0].text
      : gs.length ? 'Nenhum ponto de atenção: o saldo inicial cobre os pagamentos do período.' : 'Nenhum pagamento no período selecionado.';
  return {
    title: 'Análise com IA · Programação do dia',
    subtitle: 'Baseada nos pagamentos e no saldo inicial do período.',
    items,
    headline,
    loading,
    sub: `Análise com IA · ${items.length} ${items.length === 1 ? 'ponto de atenção' : 'pontos de atenção'} na programação`,
  };
}

export function fluxoInsights(app: AppLogic) {
  const L = fluxoLive.call(app);
  const items: Item[] = [];
  const cons = L.days.map((_, i) => L.groups.reduce((t, g: any) => t + L.running(g.data)[i], 0));
  const neg = cons.findIndex(v => v < 0);
  if (neg >= 0) {
    const worst = L.groups
      .map((g: any) => ({ g, v: L.running(g.data)[neg] }))
      .sort((a, b) => a.v - b.v)[0];
    items.push({
      label: 'Saldo negativo projetado',
      text: `Em ${L.days[neg]} o saldo consolidado fica negativo em ${brl(-cons[neg])}${worst ? `, puxado por ${worst.g.name}` : ''}. Recomenda-se antecipar recebíveis ou negociar prazos.`,
      color: '#EF4444',
    });
  }

  const outs = L.days.map((_, i) => L.groups.reduce((t, g: any) => t + g.data.pagamentos[i] - Math.min(0, g.data.inputs[i]), 0));
  const totOut = outs.reduce((t, v) => t + v, 0);
  if (totOut > 0) {
    const peak = outs.indexOf(Math.max(...outs));
    const share = outs[peak] / totOut;
    if (share >= 2 / L.days.length) {
      items.push({
        label: 'Concentração de saídas',
        text: `${Math.round(share * 100)}% das saídas do período estão em ${L.days[peak]}, contra uma média de ${Math.round(100 / L.days.length)}% por dia. Considere reprogramar pagamentos não críticos.`,
        color: '#F59E0B',
      });
    }
  }

  const totIn = L.groups.reduce((t, g: any) => t + g.data.receitas.reduce((a: number, v: number) => a + v, 0), 0);
  if (totOut > 0 || totIn > 0) {
    items.push({
      label: totIn >= totOut ? 'Receitas cobrem as saídas' : 'Receitas abaixo das saídas',
      text: `As receitas previstas somam ${brl(totIn)} e as saídas ${brl(totOut)} nos próximos ${L.days.length} dias (${totOut ? Math.round((totIn / totOut) * 100) : 100}% de cobertura).`,
      color: totIn >= totOut ? '#43B997' : '#94A3B8',
    });
  }

  const headline = L.loading ? 'Carregando a projeção…'
    : neg >= 0 ? `Saldo projetado fica negativo em ${L.days[neg]} · ${brlK(-cons[neg])} abaixo do necessário`
      : items.length ? items[0].text : 'Sem movimentos previstos para os próximos dias.';
  return {
    title: 'Análise com IA · Fluxo de caixa',
    subtitle: `Projeção para os próximos ${L.days.length} dias, por empresa.`,
    items,
    headline,
    loading: L.loading,
    sub: `Análise com IA · projeção dos próximos ${L.days.length} dias`,
  };
}

// ---- compact data sent to the app-ia edge function (LLM) ----
const r2 = (v: number) => Math.round(v * 100) / 100;

export function iaContextoProg(app: AppLogic) {
  const { groups } = progLiveGroups.call(app);
  const sel: string[] | undefined = app.state.pgEmpSel;
  const sgs = sel ? groups.filter((g: any) => sel.includes(g.emp)) : groups;
  const gs = sgs.map((g: any) => {
    const on = g.items.filter((i: any) => i.on);
    const tit = on.filter((i: any) => i.tag === 'Título');
    const total = on.reduce((t: number, i: any) => t + i.val, 0);
    return {
      empresa: g.emp,
      saldo_inicial: r2(g.saldo),
      titulos_sienge: r2(tit.reduce((t: number, i: any) => t + i.val, 0)),
      lancamentos_manuais: r2(total - tit.reduce((t: number, i: any) => t + i.val, 0)),
      qtd_pagamentos: on.length,
      aporte_necessario: r2(Math.max(0, total - g.saldo)),
      maiores_titulos: tit.slice().sort((a: any, b: any) => b.val - a.val).slice(0, 3)
        .map((i: any) => ({ credor: i.title, valor: r2(i.val), vencimento: i.due, autorizado: i.authorized !== false })),
    };
  }).sort((a, b) => b.titulos_sienge + b.lancamentos_manuais - a.titulos_sienge - a.lancamentos_manuais);

  // Totais prontos (os mesmos dos cards e do PDF), para a IA não precisar fazer contas.
  const soma = (f: (e: any) => number) => r2(gs.reduce((t, e) => t + f(e), 0));
  const titulos = sgs.flatMap((g: any) => g.items.filter((i: any) => i.on && i.tag === 'Título').map((i: any) => ({ ...i, emp: g.emp })));
  const media = titulos.length ? titulos.reduce((t: number, i: any) => t + i.val, 0) / titulos.length : 0;
  const maior = titulos.slice().sort((a: any, b: any) => b.val - a.val)[0];
  const semAut = titulos.filter((i: any) => i.authorized === false);
  const comAporte = gs.filter(e => e.aporte_necessario > 0).sort((a, b) => b.aporte_necessario - a.aporte_necessario);
  const aPagar = soma(e => e.titulos_sienge + e.lancamentos_manuais);
  const resumo = {
    empresas: gs.length,
    empresas_com_pagamentos: gs.filter(e => e.qtd_pagamentos).length,
    saldo_inicial_total: soma(e => e.saldo_inicial),
    titulos_sienge_total: soma(e => e.titulos_sienge),
    lancamentos_manuais_total: soma(e => e.lancamentos_manuais),
    total_a_pagar: aPagar,
    saldo_apos_pagamentos: r2(soma(e => e.saldo_inicial) - aPagar),
    aporte_total: soma(e => e.aporte_necessario),
    empresas_com_aporte: comAporte.length,
    maior_aporte: comAporte[0] ? { empresa: comAporte[0].empresa, valor: comAporte[0].aporte_necessario } : null,
    titulos: {
      quantidade: titulos.length,
      media: r2(media),
      sem_autorizacao: { quantidade: semAut.length, valor: r2(semAut.reduce((t: number, i: any) => t + i.val, 0)) },
      maior: maior ? { credor: maior.title, empresa: maior.emp, valor: r2(maior.val), vezes_a_media: media ? Math.round((maior.val / media) * 10) / 10 : null } : null,
    },
  };

  // Empresas sem nenhum pagamento no período vão só como contagem (economiza tokens).
  const comPag = gs.filter(e => e.qtd_pagamentos);
  const semPag = gs.filter(e => !e.qtd_pagamentos);
  return {
    periodo: { de: app.state.pgDateFrom, ate: app.state.pgDateTo },
    resumo,
    empresas: comPag.slice(0, 40),
    empresas_omitidas: Math.max(0, comPag.length - 40),
    empresas_sem_pagamentos: { quantidade: semPag.length, saldo_total: r2(semPag.reduce((t, e) => t + e.saldo_inicial, 0)) },
  };
}

export function iaContextoFluxo(app: AppLogic) {
  const L = fluxoLive.call(app);
  const empresas = L.groups.map((g: any) => ({
    empresa: g.name,
    tipo: g.tag,
    caixa_inicial: r2(g.data.caixa),
    receitas: g.data.receitas.map(r2),
    pagamentos: g.data.pagamentos.map(r2),
    lancamentos_manuais: g.data.inputs.map(r2),
    saldo_projetado: (g.aportes ? L.holdingCells : L.running(g.data)).map(r2),
    aportes_enviados: g.aportes ? g.aportes.map(r2) : undefined,
  }));
  const peso = (e: any) => Math.min(...e.saldo_projetado);

  // Totais prontos (os mesmos da análise por regras), para a IA não precisar fazer contas.
  const cons = L.days.map((_, i) => L.groups.reduce((t, g: any) => t + L.running(g.data)[i], 0));
  const neg = cons.findIndex(v => v < 0);
  const pior = neg >= 0 ? L.groups.map((g: any) => ({ g, v: L.running(g.data)[neg] })).sort((a, b) => a.v - b.v)[0] : null;
  const saidas = L.days.map((_, i) => L.groups.reduce((t, g: any) => t + g.data.pagamentos[i] - Math.min(0, g.data.inputs[i]), 0));
  const totSaidas = saidas.reduce((t, v) => t + v, 0);
  const totReceitas = L.groups.reduce((t, g: any) => t + g.data.receitas.reduce((a: number, v: number) => a + v, 0), 0);
  const pico = totSaidas > 0 ? saidas.indexOf(Math.max(...saidas)) : -1;
  const negativas = empresas.filter(e => peso(e) < 0);
  const resumo = {
    dias: L.days.length,
    caixa_inicial_total: r2(L.groups.reduce((t, g: any) => t + g.data.caixa, 0)),
    receitas_total: r2(totReceitas),
    saidas_total: r2(totSaidas),
    cobertura_receitas_pct: totSaidas ? Math.round((totReceitas / totSaidas) * 100) : 100,
    saldo_consolidado_por_dia: cons.map(r2),
    primeiro_dia_negativo: neg >= 0 ? { dia: L.days[neg], saldo: r2(cons[neg]), empresa_mais_negativa: pior?.g.name, saldo_empresa: r2(pior?.v || 0) } : null,
    dia_pico_saidas: pico >= 0 ? { dia: L.days[pico], valor: r2(saidas[pico]), pct_das_saidas: Math.round((saidas[pico] / totSaidas) * 100), media_pct_por_dia: Math.round(100 / L.days.length) } : null,
    empresas_com_saldo_negativo: negativas.length,
    total_aportes: r2(L.totalAportes),
  };
  return {
    dias: L.days,
    resumo,
    empresas: empresas.sort((a, b) => peso(a) - peso(b)).slice(0, 25),
    empresas_omitidas: Math.max(0, empresas.length - 25),
  };
}

// ---- dados do PDF da análise (Programação do dia) ----
const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const NIVEL_COR: Record<string, string> = { '#EF4444': 'critico', '#F59E0B': 'atencao', '#43B997': 'positivo' };

export function relatorioProg(app: AppLogic): RelatorioIaProg {
  const s = app.state;
  const { groups } = progLiveGroups.call(app);
  const sel: string[] | undefined = s.pgEmpSel;
  const gs = sel ? groups.filter((g: any) => sel.includes(g.emp)) : groups;
  const f2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let totSaldo = 0, totTit = 0, totMan = 0, totAporte = 0;
  const linhas = gs.map((g: any) => {
    const on = g.items.filter((i: any) => i.on);
    const tit = on.filter((i: any) => i.tag === 'Título').reduce((t: number, i: any) => t + i.val, 0);
    const man = on.filter((i: any) => i.tag === 'Manual').reduce((t: number, i: any) => t + i.val, 0);
    const total = tit + man;
    const after = g.saldo - total;
    const aporte = after < 0 ? -after : 0;
    totSaldo += g.saldo; totTit += tit; totMan += man; totAporte += aporte;
    return { cd: g.cd, emp: g.emp, saldo: g.saldo, tit, man, total, after, aporte, qtd: on.length, on };
  });
  const aportes = linhas.filter(l => l.aporte > 0.004).sort((a, b) => b.aporte - a.aporte);

  const rules = progInsights(app);
  const remote = app.iaRemoteFor('prog');
  const pontos = remote
    ? remote.items.map((i: any) => ({ label: i.label, text: i.text, nivel: i.nivel }))
    : rules.items.map(i => ({ label: i.label, text: i.text, nivel: NIVEL_COR[i.color] || 'info' }));

  const from = s.pgDateFrom || todayIso();
  const to = s.pgDateTo || from;
  const agora = new Date();
  const user = app.props.session?.user;
  const meta = user?.user_metadata || {};
  return {
    periodo: from === to ? dmy(from) : `${dmy(from)} a ${dmy(to)}`,
    geradoEm: `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    geradoPor: `por ${meta.full_name || meta.name || user?.email || 'usuário'}`,
    fonte: remote ? `Análise com IA · ${remote.modelo}` : 'Análise por regras',
    headline: remote ? remote.headline : rules.headline,
    cards: [
      { label: 'Saldo inicial', val: f2(totSaldo), sub: `${gs.length} empresas · ${gs.filter((g: any) => g.items.length).length} com movimento` },
      { label: 'Títulos Sienge', val: '-' + f2(totTit), sub: 'Parcelas em aberto', tone: 'neg' },
      { label: 'Lanç. manuais', val: '-' + f2(totMan), sub: 'Entram na programação', tone: 'neg' },
      { label: 'Aporte necessário', val: f2(totAporte), sub: aportes.length ? `${aportes.length} ${aportes.length === 1 ? 'empresa' : 'empresas'} com saldo insuficiente` : 'Nenhuma empresa', tone: totAporte ? 'aporte' : undefined },
      { label: 'Saldo após pagtos.', val: f2(totSaldo - totTit - totMan), sub: 'Consolidado do período' },
    ],
    pontos,
    aportes: aportes.map(({ on: _on, ...a }) => a),
    composicao: aportes.map(a => ({
      emp: a.emp, aporte: a.aporte,
      itens: a.on.slice().sort((x: any, y: any) => y.val - x.val).slice(0, 5).map((i: any) => ({
        credor: i.title, tipo: i.tag, venc: dmy(i.due),
        autorizado: i.tag === 'Título' ? (i.authorized === false ? 'Não' : 'Sim') : '-', val: i.val,
      })),
    })),
    arquivo: `analise-ia-programacao-${from}${to !== from ? `_a_${to}` : ''}.pdf`,
  };
}
