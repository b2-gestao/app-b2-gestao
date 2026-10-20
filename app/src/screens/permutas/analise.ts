// Permutas › Terrenos › Insights: números e alertas calculados no app (regras fixas). Alimentam os
// dashboards e vão para a IA (edge function app-ia, tela "permutas") como contexto e pontos já detectados.
import { calcular, m2, type Permuta, type UnidadeCatalogo, type UnidadeDireta } from '../../lib/permutas';

export type Nivel = 'critico' | 'atencao' | 'info' | 'positivo';
export interface Alerta { tipo: string; label: string; text: string; nivel: Nivel; causa: string; passo: string }
export interface Alocacao {
  id: string; permutante: string; origem: string; area: number | null; proprio: number; div: number | null;
  alocProprio: number; alocDiv: number; pct: number | null; situacao: 'sem-area' | 'sem-unidade' | 'parcial' | 'ok' | 'excesso';
}

export interface LinhaUnidade {
  chave: string; kind: 'dir' | 'via' | 'ambos'; enterprise_id: number; unidade: string; metragem: number | null;
  permutante: string; data: string | null; origem: string; proprio: boolean; obs: string | null;
  direta?: UnidadeDireta; permuta?: Permuta;
}

/** Unidades das permutas de área + cadastradas direto; a mesma unidade nas duas origens vira uma linha só. */
export function montarUnidades(permutas: Permuta[], diretas: UnidadeDireta[], catalogo: UnidadeCatalogo[], nomeOrigem: (p: Permuta) => string): LinhaUnidade[] {
  const company = new Map<number, number | null>();
  catalogo.forEach(u => { if (!company.has(u.enterprise_id)) company.set(u.enterprise_id, u.company_id); });
  const k = (e: number, u: string) => `${e}|${u.trim().toUpperCase()}`;
  const linhas = new Map<string, LinhaUnidade>();
  diretas.forEach(d => linhas.set(k(d.enterprise_id, d.unidade_nome), {
    chave: k(d.enterprise_id, d.unidade_nome), kind: 'dir', enterprise_id: d.enterprise_id, unidade: d.unidade_nome, metragem: d.area_privativa,
    permutante: d.permutante || '', data: d.data_contrato, origem: '', proprio: false, obs: d.observacao, direta: d,
  }));
  permutas.forEach(p => {
    const c = calcular(p);
    p.unidades.forEach(u => {
      const proprio = p.empresa_id != null && company.get(u.enterprise_id) === p.empresa_id;
      if (c.div === 0 && !proprio) return;
      const chave = k(u.enterprise_id, u.unidade_nome);
      const ja = linhas.get(chave);
      if (ja && ja.kind === 'dir') { linhas.set(chave, { ...ja, kind: 'ambos', origem: `${nomeOrigem(p)} · ${p.permutante}`, permuta: p, proprio }); return; }
      linhas.set(chave + (ja ? '#' + p.id : ''), {
        chave: chave + (ja ? '#' + p.id : ''), kind: 'via', enterprise_id: u.enterprise_id, unidade: u.unidade_nome, metragem: u.area_privativa,
        permutante: p.permutante, data: p.data_contrato || null, origem: nomeOrigem(p), proprio, obs: null, permuta: p,
      });
    });
  });
  return [...linhas.values()];
}

const TOL = 1; // m² de folga para dizer que a soma "bate"
const DIA = 86400000;

export function analisar(permutas: Permuta[], diretas: UnidadeDireta[], catalogo: UnidadeCatalogo[], nomeOrigem: (p: Permuta) => string, nomeEmp: (e: number) => string) {
  const company = new Map<number, number | null>();
  const entrega = new Map<number, string | null>();
  catalogo.forEach(u => { if (!company.has(u.enterprise_id)) { company.set(u.enterprise_id, u.company_id); entrega.set(u.enterprise_id, u.entrega || null); } });
  const noSienge = new Set(catalogo.map(u => u.unidade_id));
  const proprioDe = (p: Permuta, e: number) => p.empresa_id != null && company.get(e) === p.empresa_id;

  // ---------- por permutante ----------
  const aloc: Alocacao[] = permutas.map(p => {
    const c = calcular(p);
    const alocProprio = p.unidades.filter(u => proprioDe(p, u.enterprise_id)).reduce((s, u) => s + (u.area_privativa || 0), 0);
    const alocDiv = p.unidades.filter(u => !proprioDe(p, u.enterprise_id)).reduce((s, u) => s + (u.area_privativa || 0), 0);
    const tot = alocProprio + alocDiv;
    let situacao: Alocacao['situacao'] = 'ok';
    if (c.area == null) situacao = 'sem-area';
    else if (!p.unidades.length) situacao = 'sem-unidade';
    else if (tot > c.area + TOL) situacao = 'excesso';
    else if (tot < c.area - TOL) situacao = 'parcial';
    return { id: p.id, permutante: p.permutante, origem: nomeOrigem(p), area: c.area, proprio: c.proprio, div: c.div, alocProprio, alocDiv, pct: c.area ? tot / c.area : null, situacao };
  });

  // ---------- por terreno (origem da permuta) ----------
  const terrenos = new Map<string, { nome: string; area: number; proprio: number; div: number; n: number; matricula: number }>();
  permutas.forEach(p => {
    const c = calcular(p);
    const k = p.empresa_id != null ? 's' + p.empresa_id : 'n' + p.negocio_id;
    const t = terrenos.get(k) || { nome: nomeOrigem(p), area: 0, proprio: 0, div: 0, n: 0, matricula: 0 };
    t.area += c.area || 0; t.proprio += c.proprio; t.div += Math.max(0, c.div || 0); t.n += 1; t.matricula += p.area_matricula || 0;
    terrenos.set(k, t);
  });
  const porTerreno = [...terrenos.values()].sort((a, b) => b.area - a.area);

  // ---------- por empreendimento (onde as unidades estão) ----------
  const unidades = montarUnidades(permutas, diretas, catalogo, nomeOrigem);
  const emps = new Map<number, { enterprise_id: number; nome: string; unidades: number; m2: number; via: number; permutantes: Set<string>; entrega: string | null }>();
  unidades.forEach(l => {
    const e = emps.get(l.enterprise_id) || { enterprise_id: l.enterprise_id, nome: nomeEmp(l.enterprise_id), unidades: 0, m2: 0, via: 0, permutantes: new Set<string>(), entrega: entrega.get(l.enterprise_id) || null };
    e.unidades += 1; e.m2 += l.metragem || 0; if (l.kind !== 'dir') e.via += 1; if (l.permutante) e.permutantes.add(l.permutante.trim().toUpperCase());
    emps.set(l.enterprise_id, e);
  });
  const porEmp = [...emps.values()].sort((a, b) => b.unidades - a.unidades || b.m2 - a.m2);

  // ---------- totais ----------
  const tArea = aloc.reduce((s, a) => s + (a.area || 0), 0);
  const tProprio = aloc.reduce((s, a) => s + (a.area != null ? a.proprio : 0), 0);
  const tDiv = aloc.reduce((s, a) => s + Math.max(0, a.div || 0), 0);
  const tAloc = aloc.reduce((s, a) => s + a.alocProprio + a.alocDiv, 0);
  const pctDiv = tArea ? tDiv / tArea : null;

  // ---------- alertas (regras fixas) ----------
  const alertas: Alerta[] = [];
  const add = (a: Alerta) => alertas.push(a);
  aloc.forEach(a => {
    const p = permutas.find(x => x.id === a.id)!;
    if (a.situacao === 'sem-area') add({ tipo: 'Cálculo', nivel: 'critico', label: `${a.permutante}: sem área de permuta`, text: `${a.origem}: faltam matrícula, coeficiente ou % e não há área informada.`, causa: 'Cadastro incompleto vindo da planilha antiga.', passo: 'Completar matrícula, coeficiente e % de permuta, ou informar a área de permuta direto.' });
    if (a.div != null && a.div < 0) add({ tipo: 'Cálculo', nivel: 'critico', label: `${a.permutante}: próprio maior que a permuta`, text: `${m2(a.proprio)} m² no próprio empreendimento contra ${m2(a.area)} m² de permuta.`, causa: 'Área no próprio digitada errada ou % de permuta desatualizado.', passo: 'Conferir o contrato e corrigir o % ou a área no próprio empreendimento.' });
    if (a.situacao === 'excesso') add({ tipo: 'Alocação', nivel: 'critico', label: `${a.permutante}: mais de 100% alocado`, text: `Unidades somam ${m2(a.alocProprio + a.alocDiv)} m² para ${m2(a.area)} m² de permuta (${Math.round((a.pct || 0) * 100)}%).`, causa: 'Unidade a mais vinculada ou área privativa diferente da contratada.', passo: 'Revisar as unidades vinculadas e, se o excedente for intencional, registrar na observação.' });
    if (a.situacao === 'parcial') add({ tipo: 'Alocação', nivel: 'atencao', label: `${a.permutante}: menos do que o contratado`, text: `Unidades somam ${m2(a.alocProprio + a.alocDiv)} de ${m2(a.area)} m² (${Math.round((a.pct || 0) * 100)}%). Faltam ${m2((a.area || 0) - a.alocProprio - a.alocDiv)} m².`, causa: 'Unidades ainda não definidas ou não cadastradas.', passo: 'Definir as unidades restantes com o comercial e vincular no cadastro.' });
    if (a.situacao === 'sem-unidade') add({ tipo: 'Alocação', nivel: 'atencao', label: `${a.permutante}: nenhuma unidade definida`, text: `${m2(a.area)} m² de permuta sem unidade vinculada.`, causa: 'Permuta assinada antes da definição das unidades.', passo: 'Definir as unidades e vincular; acompanhar até a entrega.' });
    if (a.area != null && a.alocProprio + TOL < a.proprio && p.unidades.length) add({ tipo: 'Alocação', nivel: 'atencao', label: `${a.permutante}: próprio não fechado`, text: `No próprio empreendimento: ${m2(a.alocProprio)} de ${m2(a.proprio)} m².`, causa: 'Faltam unidades do próprio empreendimento.', passo: 'Vincular as unidades do próprio empreendimento.' });
    if (a.div != null && a.div > 0 && a.alocDiv + TOL < a.div && p.unidades.length) add({ tipo: 'Alocação', nivel: 'atencao', label: `${a.permutante}: diversos não fechado`, text: `Em empreendimentos diversos: ${m2(a.alocDiv)} de ${m2(a.div)} m².`, causa: 'Faltam unidades em outros empreendimentos (maior risco de controle).', passo: 'Definir em quais empreendimentos o saldo será pago e vincular.' });
    if (p.area_informada != null && a.area != null && calcular({ ...p, area_informada: null }).area != null) {
      const calc = calcular({ ...p, area_informada: null }).area!;
      if (Math.abs(calc - p.area_informada) > TOL) add({ tipo: 'Cálculo', nivel: 'atencao', label: `${a.permutante}: % divergente`, text: `Área informada ${m2(p.area_informada)} m² diferente do cálculo matrícula × coef. × % (${m2(calc)} m²).`, causa: 'Percentual arredondado ou área informada de outro aditivo.', passo: 'Confirmar no contrato qual valor vale e manter só um.' });
    }
    if (!p.anexos.some(x => x.tipo === 'Contrato')) add({ tipo: 'Documentos', nivel: 'info', label: `${a.permutante}: sem contrato anexado`, text: `${a.origem}: nenhum documento do tipo Contrato.`, causa: 'Documento ainda não digitalizado.', passo: 'Anexar o contrato assinado no cadastro.' });
    if (p.pendencia) add({ tipo: 'Pendência', nivel: 'atencao', label: `${a.permutante}: ${p.pendencia}`, text: `${a.origem}. Pendência registrada no cadastro.`, causa: 'Registrada manualmente.', passo: 'Resolver e apagar a pendência no cadastro.' });
  });
  // unidade em mais de um permutante
  const donos = new Map<string, Set<string>>();
  const reg = (e: number, u: string, quem: string) => { const k = `${e}|${u.trim().toUpperCase()}`; if (!donos.has(k)) donos.set(k, new Set()); donos.get(k)!.add(quem.trim().toUpperCase()); };
  permutas.forEach(p => p.unidades.forEach(u => reg(u.enterprise_id, u.unidade_nome, p.permutante)));
  diretas.forEach(d => { if (d.permutante) reg(d.enterprise_id, d.unidade_nome, d.permutante); });
  donos.forEach((s, k) => {
    if (s.size < 2) return;
    const [e, u] = k.split('|');
    add({ tipo: 'Duplicidade', nivel: 'critico', label: `${nomeEmp(+e)} ${u} em ${s.size} permutantes`, text: [...s].join(', ') + '.', causa: 'A mesma unidade foi prometida a mais de um permutante ou digitada errada.', passo: 'Conferir os contratos e manter a unidade em um só permutante.' });
  });
  // unidade fora do cadastro do Sienge
  const fora = [
    ...permutas.flatMap(p => p.unidades.filter(u => !noSienge.has(u.unidade_id)).map(u => `${nomeEmp(u.enterprise_id)} ${u.unidade_nome} (${p.permutante})`)),
    ...diretas.filter(d => d.unidade_id == null || !noSienge.has(d.unidade_id)).map(d => `${nomeEmp(d.enterprise_id)} ${d.unidade_nome}`),
  ];
  if (fora.length && catalogo.length) add({ tipo: 'Sienge', nivel: 'atencao', label: `${fora.length} unidade(s) fora do cadastro do Sienge`, text: fora.slice(0, 6).join('; ') + (fora.length > 6 ? '…' : '') + '.', causa: 'Unidade renomeada, desmembrada ou ainda não cadastrada no Sienge.', passo: 'Conferir no Sienge e revincular a unidade correta.' });
  // entrega próxima com saldo indefinido
  const hoje = Date.now();
  const entregas: { emp: string; data: string; dias: number; permutantes: string[] }[] = [];
  porEmp.forEach(e => {
    if (!e.entrega) return;
    const dias = Math.round((new Date(e.entrega + 'T00:00:00').getTime() - hoje) / DIA);
    if (dias < -30 || dias > 365) return;
    const pend = aloc.filter(a => {
      const p = permutas.find(x => x.id === a.id)!;
      return p.empresa_id != null && company.get(e.enterprise_id) === p.empresa_id && a.alocProprio + TOL < a.proprio;
    }).map(a => a.permutante);
    entregas.push({ emp: e.nome, data: e.entrega, dias, permutantes: pend });
    if (pend.length) add({ tipo: 'Entrega', nivel: dias <= 120 ? 'critico' : 'atencao', label: `${e.nome}: entrega em ${dias} dias`, text: `Unidade ainda não definida para: ${pend.join(', ')}.`, causa: 'Saldo de permuta no próprio empreendimento sem unidade escolhida.', passo: 'Definir as unidades antes da entrega para não travar escritura e habite-se.' });
  });
  if (pctDiv != null && pctDiv >= 0.25) add({ tipo: 'Concentração', nivel: 'atencao', label: `${Math.round(pctDiv * 100)}% da permuta em empreendimentos diversos`, text: `${m2(tDiv)} de ${m2(tArea)} m² serão pagos fora do próprio empreendimento.`, causa: 'Terrenos sem unidades suficientes no próprio projeto.', passo: 'Acompanhar de perto: é onde o risco de controle é maior.' });

  const ordem: Record<Nivel, number> = { critico: 0, atencao: 1, info: 2, positivo: 3 };
  alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);

  // ---------- contexto enxuto para a IA ----------
  const contexto = {
    resumo: {
      permutas: permutas.length, permutantes: new Set(permutas.map(p => p.permutante.trim().toUpperCase())).size,
      area_permuta_m2: +tArea.toFixed(2), proprio_m2: +tProprio.toFixed(2), diversos_m2: +tDiv.toFixed(2),
      pct_diversos: pctDiv == null ? null : +(pctDiv * 100).toFixed(1), unidades_alocadas_m2: +tAloc.toFixed(2),
      unidades_total: unidades.length, empreendimentos_com_unidades: porEmp.length,
    },
    terrenos: porTerreno.slice(0, 30).map(t => ({ nome: t.nome, permutantes: t.n, area_permuta_m2: +t.area.toFixed(2), proprio_m2: +t.proprio.toFixed(2), diversos_m2: +t.div.toFixed(2) })),
    empreendimentos: porEmp.slice(0, 30).map(e => ({ nome: e.nome, codigo: e.enterprise_id, unidades: e.unidades, m2: +e.m2.toFixed(2), permutantes: e.permutantes.size, entrega: e.entrega })),
    permutantes: permutas.slice(0, 150).map(p => {
      const a = aloc.find(x => x.id === p.id)!;
      return {
        nome: p.permutante, terreno: a.origem, area_permuta_m2: a.area == null ? null : +a.area.toFixed(2), proprio_m2: a.proprio, diversos_m2: a.div == null ? null : +a.div.toFixed(2),
        alocado_proprio_m2: +a.alocProprio.toFixed(2), alocado_diversos_m2: +a.alocDiv.toFixed(2), situacao: a.situacao,
        unidades: p.unidades.map(u => `${nomeEmp(u.enterprise_id)} ${u.unidade_nome}`), observacao: p.observacao, pendencia: p.pendencia,
        data_contrato: p.data_contrato || null, documentos: p.anexos.map(x => (x.tipo === 'Outro' ? x.descricao : x.tipo)),
      };
    }),
    unidades_diretas: diretas.slice(0, 150).map(d => ({ empreendimento: nomeEmp(d.enterprise_id), unidade: d.unidade_nome, permutante: d.permutante, observacao: d.observacao })),
  };

  return { aloc, porTerreno, porEmp, alertas, entregas, contexto, totais: { tArea, tProprio, tDiv, tAloc, pctDiv, unidades: unidades.length } };
}
