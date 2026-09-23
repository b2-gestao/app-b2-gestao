import type { AppLogic } from './AppLogic';
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
    sub: `Análise com IA · projeção dos próximos ${L.days.length} dias`,
  };
}
