// Ferramentas de CONTRATOS DE VENDA (view vw_contratos_vendas, 1 linha por contrato).
// Mesmo padrão do receber/pagar: filtros_aplicados, contagem prévia, colunas em português.
//
// Regras (definidas pelo administrador):
//   - Valor do contrato = valor total/original de venda (valor_contrato).
//   - Venda = contrato Emitido ou depois distratado (venda bruta), pela data do contrato. Permuta fica fora.
//   - Distrato = todo contrato com data de cancelamento, pela data do distrato.
//   - tipo_contrato: Venda, Venda com permuta parcial ou Permuta.
import { consulta } from "./db.ts";
import { catalogo, type Coluna, dataBR, formatarLinha, moeda, resolverColunas } from "./colunas.ts";
import { keyset, type Ordem } from "./filtros.ts";
import { codificar, type Contexto, decodificar, LEMBRETE, LIMITE_LINHAS, selectLista } from "./ferramentas.ts";

type Args = Record<string, unknown>;
const MAX_GRUPOS = 300;
const V = "parcela" as const; // a view de contratos tem uma única "visão" de linha: 1 por contrato
const DE = "public.vw_contratos_vendas c";

// ---------------------------------------------------------------- colunas

const col = (id: string, nome: string, descricao: string, tipo: Coluna["tipo"], expr = `c.${id}`): Coluna =>
  ({ id, nome, descricao, tipo, expr: { parcela: expr } });

export const COLUNAS_CONTRATOS: Coluna[] = [
  col("contrato_id", "Cód. Contrato", "Código interno do contrato no Sienge", "numero"),
  col("numero_contrato", "Nº Contrato", "Número do contrato (centro de custo/sequência)", "texto"),
  col("company_id", "Cód. Empresa", "Código da empresa no Sienge", "numero"),
  col("empresa", "Empresa", "Razão social da empresa", "texto"),
  col("nome_empreendimento", "Empreendimento", "Nome comercial do empreendimento (De Para SharePoint; sem De Para usa o nome do Sienge)", "texto"),
  col("empreendimento_sienge", "Empreendimento (Sienge)", "Nome do empreendimento/centro de custo no Sienge", "texto"),
  col("centro_custo_id", "Cód. Centro de Custo", "Centro de custo (empreendimento) do contrato", "numero"),
  col("grupo", "Grupo", "Grupo/responsável da empresa", "texto"),
  col("cidade", "Cidade", "Cidade do empreendimento", "texto"),
  col("tipo_produto", "Tipo de Produto", "Incorporação, Loteamento, Antigos...", "texto"),
  col("status_contrato", "Status", "Ativo, Distratado ou Em aprovação", "texto"),
  col("situacao_sienge", "Situação no Sienge", "Emitido, Cancelado, Autorizado ou Solicitado", "texto"),
  col("distrato", "Distrato", "Sim quando o contrato tem data de cancelamento", "texto", "case when c.distrato then 'Sim' else 'Não' end"),
  col("tipo_contrato", "Tipo de Contrato", "Venda, Venda com permuta parcial ou Permuta", "texto"),
  col("tipo_permuta", "Tipo de Permuta", "Terreno, Serviço ou Não informado", "texto"),
  col("criterio_tipo_contrato", "Critério Venda/Permuta", "Regra que classificou o contrato como venda ou permuta", "texto"),
  col("data_contrato", "Data do Contrato", "Data da venda", "data"),
  col("data_emissao", "Data de Emissão", "Data de emissão do contrato", "data"),
  col("data_distrato", "Data do Distrato", "Data de cancelamento do contrato", "data"),
  col("motivo_distrato", "Motivo do Distrato", "Motivo informado no cancelamento", "texto"),
  col("data_prevista_entrega", "Previsão de Entrega", "Data prevista de entrega", "data"),
  col("data_entrega_chaves", "Entrega das Chaves", "Data de entrega das chaves", "data"),
  col("valor_contrato", "Valor do Contrato", "Valor total/original de venda (usar este nos totais)", "moeda"),
  col("valor_liquido_contrato", "Valor Líquido do Contrato", "Soma das condições de pagamento (após desconto)", "moeda"),
  col("valor_desconto", "Desconto", "Valor do contrato - valor líquido", "moeda"),
  col("valor_distrato", "Valor Cancelamento (Sienge)", "Valor total do cancelamento registrado no Sienge", "moeda"),
  col("valor_ato", "Valor do Ato", "Soma das condições ATO", "moeda"),
  col("valor_financiamento", "Valor Financiado", "Soma das condições de financiamento bancário (FI)", "moeda"),
  col("valor_permuta", "Valor em Permuta", "Soma das condições de permuta (PT)", "moeda"),
  col("perc_permuta", "% em Permuta", "Percentual do valor pago em permuta", "numero"),
  col("valor_bens", "Valor em Bens", "Soma das condições de bens (BE)", "moeda"),
  col("valor_pago", "Valor Pago", "Resumo de referência do cadastro do contrato, já líquido de ajustes (distrato/reparcelamento). NÃO é o total recebido em caixa — para valor efetivamente pago/recebido use parcelas_receber", "moeda"),
  col("saldo_devedor", "Saldo Devedor", "Saldo em aberto das condições de pagamento", "moeda"),
  col("valor_comissao", "Comissão", "Valor total de comissão", "moeda"),
  col("tipo_correcao", "Tipo de Correção", "Periodicidade da correção: Anual ou Mensal", "texto"),
  col("indexador_principal", "Indexador", "Indexador de correção principal (IGPM, INCC, IPCA...; REAL = sem correção)", "texto"),
  col("indexadores", "Todos os Indexadores", "Todos os indexadores das condições de pagamento", "texto"),
  col("tipo_juros", "Tipo de Juros", "Simples ou Composto", "texto"),
  col("perc_juros", "% Juros", "Percentual de juros do contrato", "numero"),
  col("perc_multa", "% Multa", "Percentual de multa", "numero"),
  col("condicoes_pagamento", "Condições de Pagamento", "Tipos de condição (ATO, Parcelas Mensais, Financiamento...)", "texto"),
  col("qtd_parcelas", "Qtd. Parcelas", "Total de parcelas", "numero"),
  col("qtd_parcelas_abertas", "Qtd. Parcelas em Aberto", "Parcelas ainda em aberto", "numero"),
  col("cliente_id", "Cód. Cliente", "Código do cliente titular", "numero"),
  col("cliente_nome", "Cliente", "Nome do cliente titular", "texto"),
  col("conjuge_nome", "Cônjuge", "Nome do cônjuge", "texto"),
  col("outros_compradores", "Outros Compradores", "Demais compradores do contrato", "texto"),
  col("unidade_id", "Cód. Unidade", "Código da unidade principal", "numero"),
  col("unidade_nome", "Unidade", "Unidade principal vendida", "texto"),
  col("unidades", "Unidades do Contrato", "Todas as unidades do contrato (inclui vagas, escaninhos, armários)", "texto"),
  col("tipo_imovel", "Tipo de Imóvel", "Tipo da unidade principal (Lote, Apartamento, Casa...)", "texto"),
  col("area_privativa", "Área Privativa (m²)", "Área privativa da unidade principal", "numero"),
  col("area_privativa_total", "Área Privativa Total (m²)", "Soma das áreas privativas de todas as unidades do contrato", "numero"),
  col("area_comum", "Área Comum (m²)", "Área comum da unidade principal", "numero"),
  col("area_terreno", "Área do Terreno (m²)", "Área de terreno da unidade principal", "numero"),
  col("andar", "Andar", "Andar da unidade", "texto"),
  col("matricula", "Matrícula", "Matrícula da unidade", "texto"),
  col("estoque_comercial", "Estoque Comercial da Unidade", "Situação atual da unidade no Sienge", "texto"),
  col("situacao_unidade_sharepoint", "Situação da Unidade (SharePoint)", "Situação na planilha de unidades (Permuta Terreno/Serviço)", "texto"),
  col("corretor_principal_id", "Cód. Corretor", "Código do corretor principal", "numero"),
];

export const PADRAO_CONTRATOS = {
  parcela: [
    "contrato_id", "numero_contrato", "nome_empreendimento", "cliente_nome", "unidade_nome", "tipo_imovel",
    "area_privativa", "data_contrato", "status_contrato", "tipo_contrato", "valor_contrato",
    "tipo_correcao", "indexador_principal", "data_distrato",
  ],
  baixa: [] as string[],
};

const SENSIVEIS = ["cliente_id", "cliente_nome", "conjuge_nome", "outros_compradores"];
const TIPOS_CONTRATO = ["Venda", "Venda com permuta parcial", "Permuta"];
const STATUS = ["Ativo", "Distratado", "Em aprovação"];

// ---------------------------------------------------------------- filtros

export type VisaoContratos = "vendas" | "distratos" | "todos";

interface FiltrosContratos {
  visao?: VisaoContratos;
  incluir_permutas?: boolean;
  data_de?: string;
  data_ate?: string;
  empresa?: number | number[];
  empreendimento?: string;
  centro_custo?: number | number[];
  cliente?: string;
  unidade?: string;
  contrato?: string | number;
  status?: string[];
  tipo_contrato?: string[];
  tipo_correcao?: string;
  indexador?: string;
  tipo_imovel?: string;
  cidade?: string;
  tipo_produto?: string;
  grupo?: string;
}

const ESQUEMA_FILTROS_CONTRATOS = {
  visao: {
    type: "string", enum: ["vendas", "distratos", "todos"],
    description: "vendas (padrão) = vendas pela data do contrato, inclusive as que depois foram distratadas; permutas e contratos em aprovação ficam fora. " +
      "distratos = contratos com data de cancelamento, pela data do distrato. todos = todos os contratos, pela data do contrato.",
  },
  incluir_permutas: { type: "boolean", description: "Inclui contratos de permuta nas visões vendas/distratos. Use só se o usuário pedir." },
  data_de: { type: "string", format: "date", description: "Início do período (AAAA-MM-DD). Data do contrato; na visão distratos, data do distrato." },
  data_ate: { type: "string", format: "date", description: "Fim do período (AAAA-MM-DD)." },
  empresa: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) da empresa" },
  empreendimento: { type: "string", description: "Nome (ou parte) do empreendimento: Laguna, Altezza, Zoe..." },
  centro_custo: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) do centro de custo (empreendimento no Sienge)" },
  cliente: { type: "string", description: "Nome (ou parte) do cliente, cônjuge ou outro comprador" },
  unidade: { type: "string", description: "Unidade (ou parte), inclusive vagas/escaninhos" },
  contrato: { type: ["string", "integer"], description: "Nº do contrato (ex.: 22191/311) ou código do contrato" },
  status: { type: "array", items: { type: "string", enum: STATUS }, description: "Filtra pelo status do contrato" },
  tipo_contrato: { type: "array", items: { type: "string", enum: TIPOS_CONTRATO }, description: "Filtra pelo tipo de contrato" },
  tipo_correcao: { type: "string", enum: ["Anual", "Mensal"], description: "Periodicidade da correção" },
  indexador: { type: "string", description: "Indexador (ou parte): IGPM, INCC, IPCA, INPC, REAL, Salário..." },
  tipo_imovel: { type: "string", description: "Tipo de imóvel (ou parte): loteamento, residencial vertical, casa, comercial..." },
  cidade: { type: "string", description: "Cidade (ou parte)" },
  tipo_produto: { type: "string", description: "Tipo de produto (ou parte): Incorporação, Loteamento, Antigos" },
  grupo: { type: "string", description: "Grupo/responsável (ou parte)" },
} as const;

const lista = <T>(v: T | T[] | undefined) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const dataValida = (s?: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

interface Montado { visao: VisaoContratos; where: string[]; params: unknown[]; campoData: string; aplicados: string[] }

function montar(f: FiltrosContratos, ctx: Contexto): Montado {
  const visao = f.visao ?? "vendas";
  const where: string[] = [];
  const params: unknown[] = [];
  const aplicados: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const contem = (campos: string[], valor: string, rotulo: string) => {
    const ph = p(`%${valor}%`);
    where.push(`(${campos.map((c) => `${c} ilike ${ph}`).join(" or ")})`);
    aplicados.push(`${rotulo} contém: "${valor}"`);
  };

  for (const d of [f.data_de, f.data_ate]) if (!dataValida(d)) throw new Error(`Data inválida: ${d}. Use AAAA-MM-DD.`);
  if (ctx.perfil === "externo" && f.cliente) throw new Error("Seu acesso não permite filtrar ou ver dados de clientes.");

  const tipos = (f.tipo_contrato ?? []).map((t) => TIPOS_CONTRATO.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t);
  const comPermuta = !!f.incluir_permutas || tipos.includes("Permuta");

  let campoData: string;
  if (visao === "vendas") {
    campoData = "c.data_contrato";
    where.push(comPermuta ? "c.situacao_sienge in ('Emitido', 'Cancelado')" : "c.conta_como_venda");
    aplicados.push("Visão: VENDAS, pela data do contrato. Contam contratos emitidos, inclusive os que depois foram distratados (venda bruta)");
    aplicados.push("Ficam fora: contratos em aprovação (Solicitado/Autorizado)" + (comPermuta ? "" : " e contratos de Permuta"));
  } else if (visao === "distratos") {
    campoData = "c.data_distrato";
    where.push("c.distrato");
    if (!comPermuta) where.push("c.tipo_contrato <> 'Permuta'");
    aplicados.push("Visão: DISTRATOS, pela data do distrato. Distrato = todo contrato com data de cancelamento");
    if (!comPermuta) aplicados.push("Contratos de Permuta distratados ficam fora");
  } else {
    campoData = "c.data_contrato";
    aplicados.push("Visão: TODOS os contratos (ativos, distratados, em aprovação, vendas e permutas), pela data do contrato");
  }
  aplicados.push("Valor = Valor do Contrato (valor total/original de venda)");

  if (f.data_de) where.push(`${campoData} >= ${p(f.data_de)}::date`);
  if (f.data_ate) where.push(`${campoData} <= ${p(f.data_ate)}::date`);
  aplicados.push(f.data_de || f.data_ate
    ? `Período (${visao === "distratos" ? "data do distrato" : "data do contrato"}): ${dataBR(f.data_de) ?? "início"} a ${dataBR(f.data_ate) ?? "hoje"}`
    : "Período: sem limite (todo o histórico)");

  const empresas = lista(f.empresa);
  if (empresas.length) { where.push(`c.company_id = any(${p(empresas)}::int[])`); aplicados.push(`Empresa(s): ${empresas.join(", ")}`); }
  const ccs = lista(f.centro_custo);
  if (ccs.length) { where.push(`c.centro_custo_id = any(${p(ccs)}::int[])`); aplicados.push(`Centro(s) de custo: ${ccs.join(", ")}`); }
  if (f.empreendimento) contem(["c.nome_empreendimento", "c.empreendimento_sienge"], f.empreendimento, "Empreendimento");
  if (f.cliente) contem(["c.cliente_nome", "c.conjuge_nome", "c.outros_compradores"], f.cliente, "Cliente");
  if (f.unidade) contem(["c.unidade_nome", "c.unidades"], f.unidade, "Unidade");
  if (f.contrato !== undefined && f.contrato !== null && f.contrato !== "") {
    const ph = p(String(f.contrato));
    where.push(`(c.numero_contrato = ${ph} or c.contrato_id::text = ${ph})`);
    aplicados.push(`Contrato: ${f.contrato}`);
  }
  if (f.status?.length) { where.push(`c.status_contrato = any(${p(f.status)}::text[])`); aplicados.push(`Status: ${f.status.join(", ")}`); }
  if (tipos.length) { where.push(`c.tipo_contrato = any(${p(tipos)}::text[])`); aplicados.push(`Tipo de contrato: ${tipos.join(", ")}`); }
  if (f.tipo_correcao) { where.push(`c.tipo_correcao = ${p(f.tipo_correcao)}`); aplicados.push(`Tipo de correção: ${f.tipo_correcao}`); }
  if (f.indexador) contem(["c.indexadores"], f.indexador, "Indexador");
  if (f.tipo_imovel) contem(["c.tipo_imovel"], f.tipo_imovel, "Tipo de imóvel");
  if (f.cidade) contem(["c.cidade"], f.cidade, "Cidade");
  if (f.tipo_produto) contem(["c.tipo_produto"], f.tipo_produto, "Tipo de produto");
  if (f.grupo) contem(["c.grupo"], f.grupo, "Grupo");

  return { visao, where, params, campoData, aplicados };
}

const whereDe = (m: Montado) => (m.where.length ? `where ${m.where.join(" and ")}` : "");

// ---------------------------------------------------------------- definições

export const DEFINICOES_CONTRATOS = [
  {
    name: "totais_contratos",
    title: "Totais de contratos de venda",
    description:
      "USE PRIMEIRO para perguntas de 'quantos/quanto' sobre CONTRATOS DE VENDA: quantas vendas no mês, total vendido por empresa/empreendimento, " +
      "quantos distratos, vendas por indexador ou tipo de imóvel. Soma o Valor do Contrato (valor total/original). " +
      "Na visão vendas traz também o resumo do período: vendas brutas, distratos, vendas líquidas e permutas.",
    inputSchema: {
      type: "object",
      properties: {
        ...ESQUEMA_FILTROS_CONTRATOS,
        agrupar_por: {
          type: "array", maxItems: 2,
          items: {
            type: "string",
            enum: ["empresa", "empreendimento", "tipo_contrato", "status", "tipo_correcao", "indexador", "tipo_imovel",
              "cidade", "tipo_produto", "grupo", "cliente", "ano", "mes"],
          },
          description: "Até 2 dimensões. Vazio = só o total geral.",
        },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "consultar_contratos",
    title: "Consultar contratos de venda",
    description:
      "Lista contratos (1 linha por contrato): qual contrato/unidade um cliente comprou, contratos de um empreendimento, distratos do mês etc. " +
      `Conta antes: acima de ${LIMITE_LINHAS} linhas devolve 'volume_alto' e NÃO traz os dados; só reenvie com confirmado=true se o USUÁRIO pedir. ` +
      "Colunas padrão: contrato, empreendimento, cliente, unidade, tipo de imóvel, área privativa, data, status, tipo de contrato, valor, correção, indexador e data do distrato. " +
      "Para procurar um cliente em qualquer situação use visao='todos'.",
    inputSchema: {
      type: "object",
      properties: {
        ...ESQUEMA_FILTROS_CONTRATOS,
        colunas: { type: ["string", "array"], items: { type: "string" }, description: "'padrao' (default), 'completo' ou lista de nomes em português (veja listar_colunas com base='contratos')." },
        confirmado: { type: "boolean", description: "true só depois que o usuário aceitar o volume alto." },
        cursor: { type: "string", description: "Cursor da página seguinte (vem em proxima_pagina)." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "detalhe_contrato",
    title: "Detalhe de um contrato de venda",
    description: "Todas as informações de um contrato: cliente, unidades, áreas, valores, correção, indexadores e cada condição de pagamento.",
    inputSchema: {
      type: "object",
      properties: { contrato: { type: ["string", "integer"], description: "Nº do contrato (ex.: 22191/311) ou Cód. Contrato" } },
      required: ["contrato"],
    },
    annotations: { readOnlyHint: true },
  },
];

export const NOMES_CONTRATOS = new Set(DEFINICOES_CONTRATOS.map((d) => d.name));

// ---------------------------------------------------------------- totais

const METRICAS = `count(*) as qtd, sum(c.valor_contrato) as valor, sum(c.area_privativa) as area`;

function formatarMetricas(r: Record<string, unknown>) {
  const qtd = Number(r.qtd ?? 0);
  return {
    "Qtd. Contratos": qtd,
    "Valor dos Contratos": moeda(r.valor ?? 0),
    "Ticket Médio": qtd ? moeda(Number(r.valor ?? 0) / qtd) : null,
    "Área Privativa Total (m²)": r.area === null || r.area === undefined ? null : Number(Number(r.area).toFixed(2)),
  };
}

async function totais(a: Args, ctx: Contexto) {
  const f = a as FiltrosContratos & { agrupar_por?: string[] };
  const m = montar(f, ctx);
  const d = m.campoData;
  const dims: Record<string, [string, string] | null> = {
    empresa: ["c.company_id::text", "max(c.empresa)"],
    empreendimento: ["c.nome_empreendimento", "null"],
    tipo_contrato: ["c.tipo_contrato", "null"],
    status: ["c.status_contrato", "null"],
    tipo_correcao: ["c.tipo_correcao", "null"],
    indexador: ["c.indexador_principal", "null"],
    tipo_imovel: ["c.tipo_imovel", "null"],
    cidade: ["c.cidade", "null"],
    tipo_produto: ["c.tipo_produto", "null"],
    grupo: ["c.grupo", "null"],
    cliente: ctx.perfil === "externo" ? null : ["c.cliente_nome", "null"],
    ano: [`to_char(${d}, 'YYYY')`, "null"],
    mes: [`to_char(${d}, 'YYYY-MM')`, "null"],
  };
  const rotulos: Record<string, string> = {
    empresa: "Empresa", empreendimento: "Empreendimento", tipo_contrato: "Tipo de Contrato", status: "Status",
    tipo_correcao: "Tipo de Correção", indexador: "Indexador", tipo_imovel: "Tipo de Imóvel", cidade: "Cidade",
    tipo_produto: "Tipo de Produto", grupo: "Grupo", cliente: "Cliente", ano: "Ano", mes: "Mês",
  };
  const agrupar = f.agrupar_por ?? [];
  for (const g of agrupar) if (!(g in dims) || dims[g] === null) throw new Error(`Agrupamento '${g}' não disponível.`);

  const w = whereDe(m);
  const [geral] = await consulta(`select ${METRICAS} from ${DE} ${w}`, m.params);
  const resposta: Record<string, unknown> = { status: "ok", filtros_aplicados: m.aplicados, total_geral: formatarMetricas(geral) };

  if (agrupar.length) {
    const sel = agrupar.map((g, i) => `${dims[g]![0]} as g${i}, ${dims[g]![1]} as n${i}`).join(", ");
    const ordem = agrupar.map((_, i) => i * 2 + 1).join(", ");
    const grupos = await consulta(
      `select ${sel}, ${METRICAS} from ${DE} ${w} group by ${ordem} order by ${ordem} limit ${MAX_GRUPOS + 1}`, m.params);
    if (grupos.length > MAX_GRUPOS) {
      resposta.status = "muitos_grupos";
      resposta.orientacao_ao_claude = `Mais de ${MAX_GRUPOS} grupos. Mostre o total geral e peça para filtrar ou agrupar de forma mais ampla.`;
    } else {
      resposta.grupos = grupos.map((r) => {
        const o: Record<string, unknown> = {};
        agrupar.forEach((g, i) => { o[rotulos[g]] = r[`n${i}`] ? `${r[`g${i}`]} - ${r[`n${i}`]}` : (r[`g${i}`] ?? "(não informado)"); });
        return { ...o, ...formatarMetricas(r) };
      });
    }
  }

  // Na visão vendas, o resumo do período mostra também distratos, vendas líquidas e permutas com os mesmos filtros.
  if (m.visao === "vendas") {
    const base = { ...f, agrupar_por: undefined };
    const dist = montar({ ...base, visao: "distratos" }, ctx);
    const perm = montar({ ...base, visao: "todos", tipo_contrato: ["Permuta"], status: ["Ativo", "Distratado"] }, ctx);
    const [rd] = await consulta(`select ${METRICAS} from ${DE} ${whereDe(dist)}`, dist.params);
    const incluiuPermuta = !!f.incluir_permutas || (f.tipo_contrato ?? []).some((t) => t.toLowerCase() === "permuta");
    const [rp] = incluiuPermuta ? [null] : await consulta(`select ${METRICAS} from ${DE} ${whereDe(perm)}`, perm.params);
    const vendas = Number(geral.qtd ?? 0), valorV = Number(geral.valor ?? 0);
    const distr = Number(rd.qtd ?? 0), valorD = Number(rd.valor ?? 0);
    resposta.resumo_do_periodo = {
      "Vendas brutas (pela data do contrato)": { "Qtd.": vendas, Valor: moeda(valorV) },
      "Distratos (pela data do distrato)": { "Qtd.": distr, Valor: moeda(valorD) },
      "Vendas líquidas (vendas - distratos)": { "Qtd.": vendas - distr, Valor: moeda(valorV - valorD) },
      ...(rp ? { "Permutas no período (não somadas nas vendas)": { "Qtd.": Number(rp.qtd ?? 0), Valor: moeda(rp.valor ?? 0) } } : {}),
    };
  }
  resposta.orientacao_ao_claude ??= LEMBRETE +
    (m.visao === "vendas" ? " Mostre também o resumo_do_periodo (vendas brutas, distratos, vendas líquidas e permutas)." : "");
  return resposta;
}

// ---------------------------------------------------------------- consultar

function colunasPerfil(cols: Coluna[], ctx: Contexto) {
  return ctx.perfil === "externo" ? cols.filter((c) => !SENSIVEIS.includes(c.id)) : cols;
}

async function consultar(a: Args, ctx: Contexto) {
  const f = a as FiltrosContratos & { colunas?: string | string[]; confirmado?: boolean; cursor?: string };
  const m = montar(f, ctx);
  const r = resolverColunas(V, f.colunas, COLUNAS_CONTRATOS, PADRAO_CONTRATOS);
  const colunas = colunasPerfil(r.colunas, ctx);
  if (!colunas.length) throw new Error("Nenhuma coluna válida. Use listar_colunas com base='contratos'.");
  const w = whereDe(m);

  const [{ total }] = await consulta<{ total: string }>(`select count(*) as total from ${DE} ${w}`, m.params);
  const n = Number(total);
  if (n > LIMITE_LINHAS && !f.confirmado && !f.cursor) {
    const porAno = await consulta<{ ano: string; qtd: string }>(
      `select to_char(${m.campoData}, 'YYYY') as ano, count(*) as qtd from ${DE} ${w} group by 1 order by 1`, m.params);
    return {
      status: "volume_alto", total_linhas: n, limite_por_resposta: LIMITE_LINHAS, filtros_aplicados: m.aplicados,
      sugestoes_de_recorte: { contratos_por_ano: porAno.map((x) => ({ ano: x.ano, contratos: Number(x.qtd) })) },
      orientacao_ao_claude:
        `O recorte tem ${n.toLocaleString("pt-BR")} contratos (limite ${LIMITE_LINHAS}). NÃO traga os dados agora. ` +
        "Explique que consome muitos tokens e ofereça: filtrar mais (período, empreendimento), totais com totais_contratos, " +
        "ou continuar página a página (confirmado=true). A decisão é do usuário.",
    };
  }

  const ordem: Ordem = [[`coalesce(${m.campoData}, '1900-01-01')`, "date"], ["c.contrato_id", "int"]];
  const params = [...m.params];
  const conds = [...m.where];
  const ks = keyset(ordem, params, f.cursor ? decodificar(f.cursor) : null);
  if (ks.cond) conds.push(ks.cond);
  const linhas = await consulta(
    `select ${selectLista(colunas, V)}, ${ks.select} from ${DE}
     ${conds.length ? "where " + conds.join(" and ") : ""} order by ${ks.orderBy} limit ${LIMITE_LINHAS}`, params);

  const resposta: Record<string, unknown> = {
    status: "ok", total_linhas_do_recorte: n, linhas_nesta_resposta: linhas.length,
    filtros_aplicados: m.aplicados, colunas: colunas.map((c) => c.nome),
    dados: linhas.map((l) => formatarLinha(l, colunas, true)),
    orientacao_ao_claude: LEMBRETE,
  };
  const ultima = linhas[linhas.length - 1];
  if (linhas.length === LIMITE_LINHAS && ultima) {
    resposta.proxima_pagina = codificar(ks.extrair(ultima));
    resposta.orientacao_ao_claude = "Há mais páginas. Só busque a próxima se o usuário quiser. " + LEMBRETE;
  }
  if (r.desconhecidas.length) resposta.colunas_nao_encontradas = r.desconhecidas;
  return resposta;
}

// ---------------------------------------------------------------- detalhe

interface Condicao {
  sigla: string; condicao: string; indexador: string; parcelas: number; parcelas_abertas: number;
  primeiro_vencimento: string; valor: number; valor_pago: number; saldo: number; juros_tipo: string; juros_perc: number;
}

async function detalhe(a: Args, ctx: Contexto) {
  const chave = String(a.contrato ?? "").trim();
  if (!chave) throw new Error("Informe o Nº do contrato ou o Cód. Contrato.");
  const cols = colunasPerfil(COLUNAS_CONTRATOS, ctx);
  const linhas = await consulta(
    `select ${selectLista(cols, V)}, c.detalhe_condicoes from ${DE}
     where c.numero_contrato = $1 or c.contrato_id::text = $1 order by c.contrato_id limit 10`, [chave]);
  if (!linhas.length) {
    return { status: "nao_encontrado", orientacao_ao_claude: "Contrato não encontrado. Confira o número (ex.: 22191/311) ou busque com consultar_contratos." };
  }
  return {
    status: "ok",
    contratos: linhas.map((l) => {
      const conds = (typeof l.detalhe_condicoes === "string" ? JSON.parse(l.detalhe_condicoes) : l.detalhe_condicoes ?? []) as Condicao[];
      return {
        ...formatarLinha(l, cols, true),
        "Condições de Pagamento (detalhe)": conds.map((x) => ({
          Sigla: x.sigla, Condição: x.condicao, Indexador: x.indexador, Parcelas: x.parcelas,
          "Parcelas em Aberto": x.parcelas_abertas, "Primeiro Vencimento": dataBR(x.primeiro_vencimento),
          Valor: moeda(x.valor), "Valor Pago": moeda(x.valor_pago), Saldo: moeda(x.saldo),
          Juros: x.juros_tipo ? `${x.juros_tipo} ${x.juros_perc ?? 0}%` : null,
        })),
      };
    }),
    orientacao_ao_claude: linhas.length > 1
      ? "Mais de um contrato com esse número (empresas diferentes). Mostre todos e pergunte qual o usuário quer."
      : "Valor do contrato = valor total/original de venda. O campo \"Valor Pago\" aqui é só um resumo de " +
        "referência do cadastro (já líquido de ajustes de distrato/reparcelamento) — se o usuário perguntar " +
        "quanto foi efetivamente pago/recebido, consulte parcelas_receber (totais_receber/consultar_receber) " +
        "em vez de usar este campo.",
  };
}

// ---------------------------------------------------------------- catálogo e execução

export function catalogoContratos(ctx: Contexto) {
  const lista = catalogo(V, colunasPerfil(COLUNAS_CONTRATOS, ctx), PADRAO_CONTRATOS);
  return { status: "ok", base: "contratos", colunas: lista };
}

export async function executarContratos(nome: string, args: Args, ctx: Contexto) {
  switch (nome) {
    case "totais_contratos": return await totais(args, ctx);
    case "consultar_contratos": return await consultar(args, ctx);
    case "detalhe_contrato": return await detalhe(args, ctx);
    default: throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}
