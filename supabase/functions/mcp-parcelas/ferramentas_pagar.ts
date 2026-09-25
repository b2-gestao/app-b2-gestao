// Ferramentas do CONTAS A PAGAR (view mv_parcelas_pagar, só títulos de fato).
// Mesmo padrão do receber: contagem prévia, filtros_aplicados, colunas em português.
import { consulta } from "./db.ts";
import { catalogo, dataBR, formatarLinha, moeda, resolverColunas } from "./colunas.ts";
import { COLUNAS_PAGAR, PADRAO_PAGAR, SQL_SALDO_LIQUIDO, SQL_VALOR_LIQUIDO } from "./colunas_pagar.ts";
import { keyset, TIPO_COMPENSACAO, whereSql } from "./filtros.ts";
import {
  ESQUEMA_FILTROS_PAGAR, type FiltrosPagar, montarFiltroPagar, ORDEM_PAGAR, TIPOS_SAIDA,
} from "./filtros_pagar.ts";
import {
  codificar, type Contexto, decodificar, emCache, LEMBRETE, LEMBRETE_LISTA, LIMITE_LINHAS, selectLista, sugestoes,
} from "./ferramentas.ts";
import { exportar } from "./exportacao.ts";

const MAX_GRUPOS = 300;
type Args = Record<string, unknown>;

// ---------------------------------------------------------------- definições

export const DEFINICOES_PAGAR = [
  {
    name: "totais_pagar",
    title: "Totais do contas a pagar",
    description:
      "USE PRIMEIRO para qualquer pergunta de 'quanto' no CONTAS A PAGAR (quanto tenho a pagar, quanto paguei, quanto devo ao fornecedor X). " +
      "Somas agrupadas, sem linha a linha. Só títulos de fato (previsões ficam fora). Na visão 'pago' inclui o resumo por tipo de baixa " +
      "e o que ficou de fora (Abatimento de Adiantamento, cancelamentos...).",
    inputSchema: {
      type: "object",
      properties: {
        ...ESQUEMA_FILTROS_PAGAR,
        agrupar_por: {
          type: "array", maxItems: 2,
          items: { type: "string", enum: ["empresa", "empreendimento", "centro_custo", "credor", "tipo_documento", "status", "tipo_pagamento", "ano", "mes", "semana", "dia"] },
          description: "Até 2 dimensões. tipo_pagamento só na visão pago; status só nas visões a_pagar/todas.",
        },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "consultar_pagar",
    title: "Consultar contas a pagar",
    description:
      "Lista parcelas a pagar (visões a_pagar/todas, 1 linha por parcela) ou pagamentos (visão pago, 1 linha por baixa). " +
      `Conta antes: acima de ${LIMITE_LINHAS} linhas devolve 'volume_alto' e NÃO traz os dados; só reenvie com confirmado=true se o USUÁRIO pedir. ` +
      "Colunas padrão: código e nome da empresa, empreendimento, centro de custo, código e nome do credor, documento, emissão, " +
      "vencimento, status, valores, data e valor pago e tipo da baixa. Na visão pago a lista traz também Abatimento de Adiantamento (não soma).",
    inputSchema: {
      type: "object",
      properties: {
        ...ESQUEMA_FILTROS_PAGAR,
        colunas: { type: ["string", "array"], items: { type: "string" }, description: "'padrao' (default), 'completo' ou lista de nomes em português." },
        confirmado: { type: "boolean", description: "true só depois que o usuário aceitar o volume alto." },
        cursor: { type: "string", description: "Cursor da página seguinte (vem em proxima_pagina)." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "detalhe_pagar",
    title: "Detalhe de um título a pagar",
    description: "Todas as colunas das parcelas de um título a pagar, planos financeiros, apropriação de obra e cada baixa.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "integer", description: "Número do título (Título)" },
        parcela: { type: "integer", description: "Número da parcela (opcional: sem ele traz todas as parcelas do título)" },
      },
      required: ["titulo"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_credores",
    title: "Credores (fornecedores)",
    description: "Busca credores pelo nome e devolve código, saldo líquido a pagar e parcelas em aberto. Use para descobrir o Cód. Credor.",
    inputSchema: { type: "object", properties: { busca: { type: "string", description: "Parte do nome do credor" } }, required: ["busca"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "exportar_pagar",
    title: "Exportar contas a pagar (Excel/CSV)",
    description:
      "Gera arquivo para download do contas a pagar com os mesmos filtros de consultar_pagar e devolve link temporário (dados não passam pela conversa). " +
      "Até 50 mil linhas: Excel na hora; acima: CSV compactado em segundo plano (use status_exportacao). " +
      "O arquivo inclui as baixas de Abatimento de Adiantamento, que não entram no cálculo.",
    inputSchema: {
      type: "object",
      properties: {
        ...ESQUEMA_FILTROS_PAGAR,
        colunas: { type: ["string", "array"], items: { type: "string" }, description: "'completo' (default), 'padrao' ou lista." },
      },
    },
    annotations: { readOnlyHint: false },
  },
];

// ---------------------------------------------------------------- totais

async function totais(a: Args) {
  const f = a as FiltrosPagar & { agrupar_por?: string[] };
  const fm = montarFiltroPagar(f);
  const v = fm.linha;
  const d = fm.campoData;
  const dims: Record<string, [string, string] | null> = {
    empresa: ["m.company_id::text", "max(m.company_name)"],
    empreendimento: ["coalesce(m.nome_comercial, '(sem de-para)')", "null"],
    centro_custo: ["m.cost_center_id::text", "max(m.cost_center_name)"],
    credor: ["m.creditor_id::text", "max(m.creditor_name)"],
    tipo_documento: ["m.document_identification_name", "null"],
    status: v === "parcela" ? ["m.status_parcela", "null"] : null,
    tipo_pagamento: v === "baixa" ? ["p.operation_type_name", "null"] : null,
    ano: [`to_char(${d}, 'YYYY')`, "null"],
    mes: [`to_char(${d}, 'YYYY-MM')`, "null"],
    semana: [`to_char(date_trunc('week', ${d}), 'YYYY-MM-DD')`, "null"],
    dia: [`to_char(${d}, 'YYYY-MM-DD')`, "null"],
  };
  const agrupar = f.agrupar_por ?? [];
  for (const g of agrupar) if (!(g in dims) || dims[g] === null) throw new Error(`Agrupamento '${g}' não disponível nesta visão.`);

  const metricas = v === "baixa"
    ? `count(*) as qtd_baixas, sum(p.net_amount) as valor_pago, sum(p.gross_amount) as valor_bruto,
       sum(coalesce(p.interest_amount,0)+coalesce(p.fine_amount,0)) as juros_multa, sum(p.discount_amount) as desconto`
    : fm.visao === "a_pagar"
    ? `count(*) as qtd_parcelas, sum(${SQL_SALDO_LIQUIDO}) as saldo_liquido, sum(m.saldo_aberto_corrigido) as saldo_aberto_corrigido,
       sum(coalesce(m.impostos_titulo, 0)) as impostos, sum(coalesce(m.desconto_titulo, 0)) as desconto_titulo,
       sum(m.valor_original) as valor_original`
    : `count(*) as qtd_parcelas, sum(m.valor_original) as valor_original, sum(${SQL_VALOR_LIQUIDO}) as valor_liquido,
       sum(${SQL_SALDO_LIQUIDO}) as saldo_liquido, sum(m.saldo_aberto_corrigido) as saldo_aberto_corrigido,
       sum(m.total_liquido_pago) as valor_pago, sum(m.total_abatido_adiantamento) as abatido`;
  const nomes: Record<string, string> = {
    qtd_baixas: "Qtd. Baixas", qtd_parcelas: "Qtd. Parcelas", valor_pago: "Valor Pago", valor_bruto: "Valor Bruto",
    juros_multa: "Juros e Multa", desconto: "Desconto", valor_original: "Valor Original",
    valor_liquido: "Valor Líquido", saldo_liquido: "Saldo Líquido a Pagar",
    impostos: "Impostos Retidos", desconto_titulo: "Desconto do Título",
    saldo_aberto_corrigido: "Saldo em Aberto Corrigido (bruto)", abatido: "Abatido de Adiantamento (não soma no pago)",
  };
  const rotulos: Record<string, string> = {
    empresa: "Empresa", empreendimento: "Empreendimento", centro_custo: "Centro de Custo", credor: "Credor",
    tipo_documento: "Tipo Documento", status: "Status", tipo_pagamento: "Tipo Baixa",
    ano: "Ano", mes: "Mês", semana: "Semana (início)", dia: "Dia",
  };
  const fmt = (r: Record<string, unknown>) => {
    const o: Record<string, unknown> = {};
    agrupar.forEach((g, i) => { o[rotulos[g]] = r[`n${i}`] ? `${r[`g${i}`]} - ${r[`n${i}`]}` : r[`g${i}`]; });
    for (const [k, rot] of Object.entries(nomes)) if (k in r) o[rot] = k.startsWith("qtd") ? Number(r[k]) : moeda(r[k] ?? 0);
    return o;
  };

  const w = whereSql(fm);
  const sel = agrupar.map((g, i) => `${dims[g]![0]} as g${i}, ${dims[g]![1]} as n${i}`).join(", ");
  const ordem = agrupar.map((_, i) => i * 2 + 1).join(", ");
  const grupos = agrupar.length
    ? await consulta(`select ${sel}, ${metricas} from ${fm.from} ${w} group by ${ordem} order by ${ordem} limit ${MAX_GRUPOS + 1}`, fm.params)
    : [];
  const [geral] = await consulta(`select ${metricas} from ${fm.from} ${w}`, fm.params);

  const resposta: Record<string, unknown> = { status: "ok", filtros_aplicados: fm.aplicados, total_geral: fmt(geral) };
  if (agrupar.length) {
    if (grupos.length > MAX_GRUPOS) {
      resposta.status = "muitos_grupos";
      resposta.orientacao_ao_claude = `Mais de ${MAX_GRUPOS} grupos. Mostre o total geral e peça para filtrar ou agrupar de forma mais ampla.`;
    } else resposta.grupos = grupos.map(fmt);
  }

  // Tipo da baixa é sempre informado nos valores pagos; o que não soma vem separado.
  if (v === "baixa") {
    const todos = montarFiltroPagar({ ...f, incluir_ajustes: true, tipos_pagamento: undefined });
    const porTipo = await consulta<{ tipo: string; qtd: string; valor: string }>(
      `select p.operation_type_name as tipo, count(*) as qtd, sum(p.net_amount) as valor
       from ${todos.from} ${whereSql(todos)} group by 1 order by 3 desc nulls last`, todos.params);
    const considerados = f.incluir_ajustes ? null : (f.tipos_pagamento?.length ? f.tipos_pagamento : TIPOS_SAIDA).map((t) => t.toLowerCase());
    const linha = (r: { tipo: string; qtd: string; valor: string }) => ({ "Tipo Baixa": r.tipo, "Qtd. Baixas": Number(r.qtd), "Valor": moeda(r.valor) });
    resposta.por_tipo_pagamento = porTipo.filter((r) => !considerados || considerados.includes(r.tipo.toLowerCase())).map(linha);
    const fora = porTipo.filter((r) => considerados && !considerados.includes(r.tipo.toLowerCase()));
    if (fora.length) {
      resposta.baixas_nao_somadas = fora.map((r) => ({
        ...linha(r),
        Motivo: r.tipo === TIPO_COMPENSACAO ? "Compensação: o adiantamento já foi pago antes" : "Não é pagamento (ajuste)",
      }));
    }
  } else if (fm.visao === "a_pagar" && !agrupar.includes("tipo_documento")) {
    const porDoc = await consulta<{ tipo: string; qtd: string; saldo: string }>(
      `select m.document_identification_name as tipo, count(*) as qtd, sum(${SQL_SALDO_LIQUIDO}) as saldo
       from ${fm.from} ${w} group by 1 order by 3 desc nulls last limit 10`, fm.params);
    resposta.por_tipo_documento = porDoc.map((r) => ({ "Tipo Documento": r.tipo, "Qtd. Parcelas": Number(r.qtd), "Saldo Líquido a Pagar": moeda(r.saldo) }));
  }
  if (fm.avisos.length) resposta.avisos = fm.avisos;
  resposta.orientacao_ao_claude ??= LEMBRETE;
  return resposta;
}

// ---------------------------------------------------------------- consultar

async function consultar(a: Args) {
  const f = a as FiltrosPagar & { colunas?: string | string[]; confirmado?: boolean; cursor?: string };
  const fm = montarFiltroPagar(f, { listagem: true });
  const v = fm.linha;
  const { colunas, desconhecidas } = resolverColunas(v, f.colunas, COLUNAS_PAGAR, PADRAO_PAGAR);
  if (!colunas.length) throw new Error("Nenhuma coluna válida. Use listar_colunas com base='pagar'.");
  const completo = f.colunas === "completo" || f.colunas === "todas";
  const w = whereSql(fm);

  const [{ total }] = await consulta<{ total: string }>(`select count(*) as total from ${fm.from} ${w}`, fm.params);
  const n = Number(total);
  if (n > LIMITE_LINHAS && !f.confirmado && !f.cursor) {
    return {
      status: "volume_alto", total_linhas: n, limite_por_resposta: LIMITE_LINHAS,
      filtros_aplicados: fm.aplicados, sugestoes_de_recorte: await sugestoes(fm),
      orientacao_ao_claude:
        `O recorte tem ${n.toLocaleString("pt-BR")} linhas (limite ${LIMITE_LINHAS}). NÃO traga os dados agora. ` +
        "Explique que consome muitos tokens e ofereça: filtrar mais (use as sugestões), totais com totais_pagar, " +
        (n > 5000 ? "arquivo com exportar_pagar (recomendado), " : "arquivo com exportar_pagar, ") +
        "ou continuar página a página (confirmado=true). A decisão é do usuário.",
    };
  }

  const params = [...fm.params];
  const conds = [...fm.where];
  const ks = keyset(ORDEM_PAGAR[v], params, f.cursor ? decodificar(f.cursor) : null);
  if (ks.cond) conds.push(ks.cond);
  const linhas = await consulta(
    `select ${selectLista(colunas, v)}, ${ks.select} from ${fm.from}
     ${conds.length ? "where " + conds.join(" and ") : ""} order by ${ks.orderBy} limit ${LIMITE_LINHAS}`, params);

  const ultima = linhas[linhas.length - 1];
  const resposta: Record<string, unknown> = {
    status: "ok", total_linhas_do_recorte: n, linhas_nesta_resposta: linhas.length,
    filtros_aplicados: fm.aplicados, colunas: colunas.map((c) => c.nome),
    dados: linhas.map((l) => formatarLinha(l, colunas, completo)),
  };
  if (linhas.length === LIMITE_LINHAS && ultima) {
    resposta.proxima_pagina = codificar(ks.extrair(ultima));
    resposta.orientacao_ao_claude = "Há mais páginas. Só busque a próxima se o usuário quiser. " + LEMBRETE_LISTA;
  } else resposta.orientacao_ao_claude = LEMBRETE_LISTA;
  if (desconhecidas.length) resposta.colunas_nao_encontradas = desconhecidas;
  if (fm.avisos.length) resposta.avisos = fm.avisos;
  return resposta;
}

// ---------------------------------------------------------------- detalhe

async function detalhe(a: Args) {
  const params: unknown[] = [a.titulo];
  let extra = "";
  if (a.parcela !== undefined) { params.push(a.parcela); extra = " and m.installment_id = $2"; }
  const cols = COLUNAS_PAGAR.filter((c) => c.expr.parcela);
  const parcelas = await consulta(
    `select ${selectLista(cols, "parcela")} from public.mv_parcelas_pagar m where m.bill_id = $1${extra} order by m.installment_id limit 100`, params);
  if (!parcelas.length) {
    return { status: "nao_encontrado", orientacao_ao_claude: "Título não encontrado. Pode ser um título de previsão (que não é carregado) ou número errado." };
  }
  const baixas = await consulta<Record<string, unknown>>(
    `select m.installment_id, p.payment_date, p.operation_type_name, mcp.categoria_pagamento(p.operation_type_name) as categoria,
            p.gross_amount, p.net_amount, coalesce(p.interest_amount,0)+coalesce(p.fine_amount,0) as juros_multa, p.discount_amount
     from public.parcelas_pagar_payments p join public.mv_parcelas_pagar m on m.chave_parcela = p.chave_parcela
     where m.bill_id = $1${extra} order by m.installment_id, p.payment_date`, params);
  return {
    status: "ok",
    parcelas: parcelas.map((p) => formatarLinha(p, cols, true)),
    baixas: baixas.map((b) => ({
      Parcela: b.installment_id, "Data Pagamento": dataBR(b.payment_date), "Tipo Baixa": b.operation_type_name,
      Categoria: b.categoria, "Valor Bruto": moeda(b.gross_amount), "Valor Pago": moeda(b.net_amount),
      "Juros e Multa": moeda(b.juros_multa), Desconto: moeda(b.discount_amount),
    })),
    orientacao_ao_claude: "Baixas com Categoria 'Compensação' (Abatimento de Adiantamento) ou 'Ajuste' não são saída de caixa; deixe isso claro.",
  };
}

// ---------------------------------------------------------------- credores

async function listarCredores(a: Args) {
  const busca = String(a.busca ?? "").trim();
  if (busca.length < 2) throw new Error("Informe pelo menos 2 letras do nome do credor.");
  const linhas = await emCache(`credores:${busca.toLowerCase()}`, () =>
    consulta<Record<string, unknown>>(
      `select m.creditor_id, max(m.creditor_name) as credor, count(*) as parcelas,
              count(*) filter (where m.status_parcela = 'Em aberto') as abertas,
              sum(${SQL_SALDO_LIQUIDO}) filter (where m.status_parcela = 'Em aberto') as saldo,
              max(m.ultimo_pagamento) as ultimo_pagamento
       from public.mv_parcelas_pagar m where m.creditor_name ilike $1
       group by 1 order by 3 desc limit 30`, [`%${busca}%`]));
  return {
    status: "ok",
    credores: linhas.map((l) => ({
      "Cód. Credor": l.creditor_id, Credor: l.credor, "Parcelas (total)": Number(l.parcelas),
      "Parcelas em Aberto": Number(l.abertas), "Saldo Líquido a Pagar": moeda(l.saldo ?? 0),
      "Último Pagamento": dataBR(l.ultimo_pagamento),
    })),
  };
}

export function catalogoPagar(visao?: string) {
  const v = visao === "pago" ? "baixa" : "parcela";
  return { status: "ok", base: "pagar", visao: visao ?? "a_pagar", colunas: catalogo(v, COLUNAS_PAGAR, PADRAO_PAGAR) };
}

export const NOMES_PAGAR = new Set(DEFINICOES_PAGAR.map((d) => d.name));

export async function executarPagar(nome: string, args: Args, ctx: Contexto) {
  switch (nome) {
    case "totais_pagar": return await totais(args);
    case "consultar_pagar": return await consultar(args);
    case "detalhe_pagar": return await detalhe(args);
    case "listar_credores": return await listarCredores(args);
    case "exportar_pagar": return await exportar(args, ctx, "pagar");
    default: throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}
