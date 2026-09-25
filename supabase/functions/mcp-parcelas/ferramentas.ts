// Ferramentas expostas ao Claude. Cada uma devolve JSON com:
//   status, filtros_aplicados (texto em PT para o usuário), dados e orientação ao Claude.
import { consulta } from "./db.ts";
import {
  catalogo, COLUNAS, type Coluna, dataBR, formatarLinha, moeda, resolverColunas, type Visao,
} from "./colunas.ts";
import { ESQUEMA_FILTROS, type Filtros, keyset, montarFiltro, ORDEM_RECEBER, TIPOS_CAIXA, whereSql } from "./filtros.ts";
import { exportar, statusExportacao } from "./exportacao.ts";

export interface Contexto { clientId: string; perfil: "interno" | "externo" }

export const LIMITE_LINHAS = 500;
const MAX_GRUPOS = 300;
const SENSIVEIS = ["client_name", "client_id", "document_number"];
export const LEMBRETE = "Informe ao usuário, de forma curta, os filtros_aplicados.";
export const LEMBRETE_LISTA = LEMBRETE + " Se a lista trouxer baixas de 'Abatimento de Adiantamento', avise que elas aparecem " +
  "mas não entram no cálculo, porque o adiantamento já foi baixado antes.";

// ---------------------------------------------------------------- utilitários

function aplicarPerfil(colunas: Coluna[], ctx: Contexto) {
  return ctx.perfil === "externo" ? colunas.filter((c) => !SENSIVEIS.includes(c.id)) : colunas;
}

function validarPerfil(f: Filtros, ctx: Contexto) {
  if (ctx.perfil === "externo" && f.cliente) {
    throw new Error("Seu acesso não permite filtrar ou ver dados de clientes.");
  }
}

export const selectLista = (cols: Coluna[], v: Visao) => cols.map((c) => `${c.expr[v]} as "${c.id}"`).join(", ");

export const codificar = (o: unknown) => btoa(JSON.stringify(o));
export const decodificar = (s: string) => JSON.parse(atob(s));

// Sugestões de recorte quando o volume é alto (contagens por ano e por empresa).
export async function sugestoes(fm: ReturnType<typeof montarFiltro>) {
  try {
    const w = whereSql(fm);
    const porAno = await consulta<{ ano: string; linhas: string }>(
      `select to_char(${fm.campoData}, 'YYYY') as ano, count(*) as linhas
       from ${fm.from} ${w} group by 1 order by 1 limit 20`, fm.params);
    const porEmpresa = await consulta<{ empresa: number; nome: string; linhas: string }>(
      `select m.company_id as empresa, coalesce(max(m.nome_comercial), max(m.company_name)) as nome, count(*) as linhas
       from ${fm.from} ${w} group by 1 order by 3 desc limit 10`, fm.params);
    return {
      linhas_por_ano: porAno.map((r) => ({ ano: r.ano, linhas: Number(r.linhas) })),
      maiores_empresas: porEmpresa.map((r) => ({ "Cód. Empresa": r.empresa, Empreendimento: r.nome, linhas: Number(r.linhas) })),
    };
  } catch {
    return undefined; // sugestão é opcional; não derruba a resposta
  }
}

// ---------------------------------------------------------------- definições (tools/list)

const filtrosProps = ESQUEMA_FILTROS;

export const DEFINICOES = [
  {
    name: "totais_receber",
    title: "Totais do contas a receber",
    description:
      "USE PRIMEIRO para qualquer pergunta de 'quanto' (quanto tenho a receber, quanto recebi, quanto vou receber da empresa X este mês). " +
      "Devolve somas agrupadas, sem trazer linha a linha. Na visão 'recebido' sempre inclui o resumo por tipo de recebimento " +
      "e o que ficou de fora (ajustes). Na visão 'a_receber' inclui o resumo por tipo de parcela.",
    inputSchema: {
      type: "object",
      properties: {
        ...filtrosProps,
        agrupar_por: {
          type: "array", maxItems: 2,
          items: { type: "string", enum: ["empresa", "empreendimento", "centro_custo", "cliente", "tipo_parcela", "grupo_parcela", "tipo_recebimento", "status", "ano", "mes", "semana", "dia"] },
          description: "Até 2 dimensões. Vazio = só o total geral. tipo_recebimento só na visão recebido; status só nas visões a_receber/todas.",
        },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "consultar_receber",
    title: "Consultar contas a receber",
    description:
      "Lista parcelas (visões a_receber/todas, 1 linha por parcela) ou recebimentos (visão recebido, 1 linha por baixa). " +
      `Conta antes de trazer: acima de ${LIMITE_LINHAS} linhas devolve status 'volume_alto' com sugestões e NÃO traz os dados. ` +
      "Só reenvie com confirmado=true se o USUÁRIO disser que quer continuar. Colunas padrão: empresa, empreendimento, centro de custo, " +
      "unidade, cliente, vencimento, tipo de parcela, valores, data e valor pago e tipo do recebimento.",
    inputSchema: {
      type: "object",
      properties: {
        ...filtrosProps,
        colunas: {
          type: ["string", "array"], items: { type: "string" },
          description: "'padrao' (default), 'completo' (todas) ou lista de nomes em português (veja listar_colunas).",
        },
        confirmado: { type: "boolean", description: "true só depois que o usuário aceitar o volume alto." },
        cursor: { type: "string", description: "Cursor da página seguinte (vem em proxima_pagina)." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "detalhe_receber",
    title: "Detalhe de uma parcela a receber",
    description: "Todas as colunas de uma parcela, planos financeiros e cada baixa (recebimento, ajuste) com data, tipo e valor.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "integer", description: "Número do título (Título)" },
        parcela: { type: "integer", description: "Número da parcela no título (Parcela)" },
        tipo_parcela: { type: "string", description: "Sigla do tipo de parcela, se o título tiver mais de um (PM, FI...)" },
      },
      required: ["titulo", "parcela"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_empresas",
    title: "Empresas e empreendimentos",
    description: "Lista empresas/empreendimentos que têm saldo a receber, com quantidade de parcelas em aberto e saldo. Use para descobrir o código da empresa.",
    inputSchema: { type: "object", properties: { busca: { type: "string", description: "Parte do nome da empresa ou empreendimento" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_centros_custo",
    title: "Centros de custo",
    description: "Lista centros de custo com empresa e saldo a receber.",
    inputSchema: {
      type: "object",
      properties: {
        empresa: { type: "integer", description: "Filtra por código da empresa" },
        busca: { type: "string", description: "Parte do nome do centro de custo" },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "listar_colunas",
    title: "Colunas disponíveis",
    description: "Lista as colunas (nomes em português) de cada base e visão, com descrição e se são padrão.",
    inputSchema: {
      type: "object",
      properties: {
        base: { type: "string", enum: ["receber", "pagar", "contratos"], description: "receber (padrão), pagar ou contratos" },
        visao: { type: "string", enum: ["a_receber", "recebido", "a_pagar", "pago", "todas"] },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "exportar_receber",
    title: "Exportar contas a receber (Excel/CSV)",
    description:
      "Gera arquivo para download com os mesmos filtros de consultar_receber e devolve um link temporário. Os dados NÃO passam pela conversa. " +
      "Até 50 mil linhas: Excel na hora. Acima: CSV compactado (.csv.gz) gerado em segundo plano; devolve o código da exportação para consultar com status_exportacao. " +
      "Use quando o usuário pedir muitos dados, 'tudo', vários anos ou a tabela inteira.",
    inputSchema: {
      type: "object",
      properties: {
        ...filtrosProps,
        colunas: { type: ["string", "array"], items: { type: "string" }, description: "'completo' (default na exportação), 'padrao' ou lista." },
      },
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: "status_exportacao",
    title: "Status da exportação",
    description: "Verifica se uma exportação em segundo plano terminou e devolve o(s) link(s) de download.",
    inputSchema: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"] },
    annotations: { readOnlyHint: true },
  },
];

// ---------------------------------------------------------------- implementações

type Args = Record<string, unknown>;

async function totais(a: Args, ctx: Contexto) {
  const f = a as Filtros & { agrupar_por?: string[] };
  validarPerfil(f, ctx);
  const fm = montarFiltro(f);
  const v = fm.linha;
  const d = fm.campoData;

  const dims: Record<string, [string, string] | null> = {
    empresa: ["m.company_id::text", "max(m.company_name)"],
    empreendimento: ["coalesce(m.nome_comercial, '(sem de-para)')", "null"],
    centro_custo: ["m.cost_center_id::text", "max(m.cost_center_name)"],
    cliente: ctx.perfil === "externo" ? null : ["m.client_name", "null"],
    tipo_parcela: ["m.payment_term_id", "max(m.payment_term_description)"],
    grupo_parcela: ["coalesce(m.grupo_parcela, 'Demais')", "null"],
    tipo_recebimento: v === "baixa" ? ["r.operation_type_name", "null"] : null,
    status: v === "parcela" ? ["m.status_parcela", "null"] : null,
    ano: [`to_char(${d}, 'YYYY')`, "null"],
    mes: [`to_char(${d}, 'YYYY-MM')`, "null"],
    semana: [`to_char(date_trunc('week', ${d}), 'YYYY-MM-DD')`, "null"],
    dia: [`to_char(${d}, 'YYYY-MM-DD')`, "null"],
  };
  const agrupar = f.agrupar_por ?? [];
  for (const g of agrupar) {
    if (!(g in dims) || dims[g] === null) throw new Error(`Agrupamento '${g}' não disponível nesta visão/perfil.`);
  }

  const metricas = v === "baixa"
    ? `count(*) as qtd_baixas, sum(r.net_amount) as valor_pago, sum(r.gross_amount) as valor_bruto,
       sum(coalesce(r.interest_amount,0)+coalesce(r.fine_amount,0)) as juros_multa, sum(r.discount_amount) as desconto`
    : fm.visao === "a_receber"
    ? `count(*) as qtd_parcelas, sum(m.valor_original) as valor_original, sum(m.saldo_aberto) as saldo_aberto,
       sum(m.saldo_aberto_corrigido) as saldo_aberto_corrigido`
    : `count(*) as qtd_parcelas, sum(m.valor_original) as valor_original, sum(m.saldo_aberto_corrigido) as saldo_aberto_corrigido,
       sum(m.total_liquido_recebido) as valor_pago`;

  const nomesMetricas: Record<string, string> = {
    qtd_baixas: "Qtd. Baixas", qtd_parcelas: "Qtd. Parcelas", valor_pago: "Valor Pago", valor_bruto: "Valor Bruto",
    juros_multa: "Juros e Multa", desconto: "Desconto", valor_original: "Valor Original",
    saldo_aberto: "Saldo em Aberto", saldo_aberto_corrigido: "Saldo em Aberto Corrigido",
  };
  const rotulosDim: Record<string, string> = {
    empresa: "Empresa", empreendimento: "Empreendimento", centro_custo: "Centro de Custo", cliente: "Cliente",
    tipo_parcela: "Tipo Parcela", grupo_parcela: "Grupo Parcela", tipo_recebimento: "Tipo Recebimento",
    status: "Status", ano: "Ano", mes: "Mês", semana: "Semana (início)", dia: "Dia",
  };
  const fmt = (r: Record<string, unknown>) => {
    const o: Record<string, unknown> = {};
    agrupar.forEach((g, i) => {
      const chave = r[`g${i}`];
      const nome = r[`n${i}`];
      o[rotulosDim[g]] = nome ? `${chave} - ${nome}` : chave;
    });
    for (const [k, rot] of Object.entries(nomesMetricas)) {
      if (k in r) o[rot] = k.startsWith("qtd") ? Number(r[k]) : moeda(r[k] ?? 0);
    }
    return o;
  };

  const w = whereSql(fm);
  const sel = agrupar.map((g, i) => `${dims[g]![0]} as g${i}, ${dims[g]![1]} as n${i}`).join(", ");
  const grupos = agrupar.length
    ? await consulta(
      `select ${sel}, ${metricas} from ${fm.from} ${w}
       group by ${agrupar.map((_, i) => i * 2 + 1).join(", ")}
       order by ${agrupar.map((_, i) => i * 2 + 1).join(", ")} limit ${MAX_GRUPOS + 1}`, fm.params)
    : [];
  const [geral] = await consulta(`select ${metricas} from ${fm.from} ${w}`, fm.params);

  const resposta: Record<string, unknown> = {
    status: "ok",
    filtros_aplicados: fm.aplicados,
    total_geral: fmt(geral),
  };
  if (agrupar.length) {
    if (grupos.length > MAX_GRUPOS) {
      resposta.status = "muitos_grupos";
      resposta.orientacao_ao_claude = `Mais de ${MAX_GRUPOS} grupos. Mostre o total geral e peça para o usuário filtrar ou agrupar de forma mais ampla (ex.: ano em vez de mês).`;
    } else {
      resposta.grupos = grupos.map(fmt);
    }
  }

  // Tipo do recebimento é obrigatório nas respostas de valores recebidos.
  if (v === "baixa") {
    const todos = montarFiltro({ ...f, incluir_ajustes: true, tipos_recebimento: undefined });
    const porTipo = await consulta<{ tipo: string; qtd: string; valor: string }>(
      `select r.operation_type_name as tipo, count(*) as qtd, sum(r.net_amount) as valor
       from ${todos.from} ${whereSql(todos)} group by 1 order by 3 desc nulls last`, todos.params);
    const considerados = f.incluir_ajustes ? null : (f.tipos_recebimento?.length ? f.tipos_recebimento : TIPOS_CAIXA).map((t) => t.toLowerCase());
    const linhaTipo = (r: { tipo: string; qtd: string; valor: string }) => ({ "Tipo Recebimento": r.tipo, "Qtd. Baixas": Number(r.qtd), "Valor Pago": moeda(r.valor) });
    resposta.por_tipo_recebimento = porTipo.filter((r) => !considerados || considerados.includes(r.tipo.toLowerCase())).map(linhaTipo);
    const fora = porTipo.filter((r) => considerados && !considerados.includes(r.tipo.toLowerCase())).map(linhaTipo);
    if (fora.length) resposta.movimentacoes_nao_somadas = fora;
  } else if (fm.visao === "a_receber" && !agrupar.includes("tipo_parcela")) {
    const porTipo = await consulta<{ tipo: string; qtd: string; saldo: string }>(
      `select coalesce(m.payment_term_description, m.payment_term_id) as tipo, count(*) as qtd, sum(m.saldo_aberto_corrigido) as saldo
       from ${fm.from} ${w} group by 1 order by 3 desc nulls last limit 15`, fm.params);
    resposta.por_tipo_parcela = porTipo.map((r) => ({ "Tipo Parcela": r.tipo, "Qtd. Parcelas": Number(r.qtd), "Saldo em Aberto Corrigido": moeda(r.saldo) }));
  }
  if (fm.avisos.length) resposta.avisos = fm.avisos;
  resposta.orientacao_ao_claude ??= LEMBRETE;
  return resposta;
}

async function consultar(a: Args, ctx: Contexto) {
  const f = a as Filtros & { colunas?: string | string[]; confirmado?: boolean; cursor?: string };
  validarPerfil(f, ctx);
  const fm = montarFiltro(f, { listagem: true });
  const v = fm.linha;
  const { colunas: cols0, desconhecidas } = resolverColunas(v, f.colunas);
  const colunas = aplicarPerfil(cols0, ctx);
  if (!colunas.length) throw new Error("Nenhuma coluna válida. Use listar_colunas.");
  const completo = f.colunas === "completo" || f.colunas === "todas";
  const w = whereSql(fm);

  const [{ total }] = await consulta<{ total: string }>(`select count(*) as total from ${fm.from} ${w}`, fm.params);
  const n = Number(total);

  if (n > LIMITE_LINHAS && !f.confirmado && !f.cursor) {
    return {
      status: "volume_alto",
      total_linhas: n,
      limite_por_resposta: LIMITE_LINHAS,
      filtros_aplicados: fm.aplicados,
      sugestoes_de_recorte: await sugestoes(fm),
      orientacao_ao_claude:
        `O recorte tem ${n.toLocaleString("pt-BR")} linhas (limite ${LIMITE_LINHAS} por resposta). NÃO traga os dados agora. ` +
        "Explique ao usuário que isso consome muitos tokens e ofereça: filtrar mais (use as sugestões), ver totais com totais_receber, " +
        (n > 5000 ? "gerar arquivo Excel/CSV com exportar_receber (recomendado para esse volume), " : "gerar arquivo com exportar_receber, ") +
        "ou continuar página a página (confirmado=true). Deixe a decisão com o usuário.",
    };
  }

  const params = [...fm.params];
  const conds = [...fm.where];
  const ks = keyset(ORDEM_RECEBER[v], params, f.cursor ? decodificar(f.cursor) : null);
  if (ks.cond) conds.push(ks.cond);
  const linhas = await consulta(
    `select ${selectLista(colunas, v)}, ${ks.select}
     from ${fm.from} ${conds.length ? "where " + conds.join(" and ") : ""}
     order by ${ks.orderBy} limit ${LIMITE_LINHAS}`, params);

  const ultima = linhas[linhas.length - 1];
  const temMais = linhas.length === LIMITE_LINHAS;
  const resposta: Record<string, unknown> = {
    status: "ok",
    total_linhas_do_recorte: n,
    linhas_nesta_resposta: linhas.length,
    filtros_aplicados: fm.aplicados,
    colunas: colunas.map((c) => c.nome),
    dados: linhas.map((l) => formatarLinha(l, colunas, completo)),
  };
  if (temMais && ultima) {
    resposta.proxima_pagina = codificar(ks.extrair(ultima));
    resposta.orientacao_ao_claude = "Há mais páginas. Só busque a próxima (cursor=proxima_pagina) se o usuário quiser. " + LEMBRETE_LISTA;
  } else {
    resposta.orientacao_ao_claude = LEMBRETE_LISTA;
  }
  if (desconhecidas.length) resposta.colunas_nao_encontradas = desconhecidas;
  if (fm.avisos.length) resposta.avisos = fm.avisos;
  return resposta;
}

async function detalhe(a: Args, ctx: Contexto) {
  const params: unknown[] = [a.titulo, a.parcela];
  let extra = "";
  if (a.tipo_parcela) { params.push(String(a.tipo_parcela)); extra = ` and lower(m.payment_term_id) = lower($3)`; }
  const cols = aplicarPerfil(COLUNAS.filter((c) => c.expr.parcela), ctx);
  const parcelas = await consulta(
    `select ${selectLista(cols, "parcela")} from public.mv_parcelas_receber m
     where m.bill_id = $1 and m.installment_id = $2${extra}`, params);
  if (!parcelas.length) return { status: "nao_encontrada", orientacao_ao_claude: "Parcela não encontrada. Confira título e parcela." };

  const baixas = await consulta<Record<string, unknown>>(
    `select r.payment_term_id, r.payment_date, r.operation_type_name, mcp.categoria_operacao(r.operation_type_name) as categoria,
            r.gross_amount, r.net_amount, coalesce(r.interest_amount,0)+coalesce(r.fine_amount,0) as juros_multa,
            r.discount_amount, r.account_number
     from public.parcelas_receber_receipts r
     where r.bill_id = $1 and r.installment_id = $2${extra.replace("m.", "r.")}
     order by r.payment_date`, params);

  return {
    status: "ok",
    parcelas: parcelas.map((p) => formatarLinha(p, cols, true)),
    baixas: baixas.map((b) => ({
      "Sigla Tipo Parcela": b.payment_term_id,
      "Data Pagamento": dataBR(b.payment_date),
      "Tipo Recebimento": b.operation_type_name,
      "Categoria": b.categoria,
      "Valor Bruto": moeda(b.gross_amount),
      "Valor Pago": moeda(b.net_amount),
      "Juros e Multa": moeda(b.juros_multa),
      "Desconto": moeda(b.discount_amount),
      "Conta Corrente": b.account_number,
    })),
    orientacao_ao_claude: "Baixas com Categoria 'Ajuste' não são entrada de caixa; deixe isso claro ao usuário.",
  };
}

// Listas simples mudam pouco: cache de 10 minutos por instância da função.
const cache = new Map<string, { em: number; dados: unknown }>();
export async function emCache<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(chave);
  if (c && Date.now() - c.em < 600_000) return c.dados as T;
  const dados = await fn();
  cache.set(chave, { em: Date.now(), dados });
  return dados;
}

async function listarEmpresas(a: Args) {
  const linhas = await emCache("empresas", () =>
    // Valores pelo índice covering ix_mv_pr_agregado (~2s); nomes via subconsultas pequenas.
    // Varrer a view inteira levava ~16s.
    consulta<Record<string, unknown>>(
      `with t as (
         select m.company_id, count(*) as parcelas_abertas, sum(m.saldo_aberto_corrigido) as saldo
         from public.mv_parcelas_receber m
         where m.status_parcela in ('A receber', 'Recebida') and m.saldo_aberto > 0
         group by 1)
       select t.company_id,
              (select m2.company_name from public.mv_parcelas_receber m2 where m2.company_id = t.company_id limit 1) as empresa,
              (select string_agg(distinct d.nome, ', ') from public.de_para_sharepoint d where d.cd_empresa = t.company_id) as empreendimentos,
              t.parcelas_abertas, t.saldo
       from t order by 1`));
  const busca = a.busca ? String(a.busca).toLowerCase() : null;
  return {
    status: "ok",
    empresas: linhas
      .filter((l) => !busca || `${l.empresa} ${l.empreendimentos ?? ""}`.toLowerCase().includes(busca))
      .map((l) => ({
        "Cód. Empresa": l.company_id, Empresa: l.empresa, Empreendimentos: l.empreendimentos,
        "Parcelas em Aberto": Number(l.parcelas_abertas), "Saldo a Receber Corrigido": moeda(l.saldo ?? 0),
      })),
  };
}

async function listarCentros(a: Args) {
  const linhas = await emCache("centros", () =>
    consulta<Record<string, unknown>>(
      `with t as (
         select m.cost_center_id, m.company_id, sum(m.saldo_aberto_corrigido) as saldo
         from public.mv_parcelas_receber m
         where m.status_parcela in ('A receber', 'Recebida') and m.saldo_aberto > 0 and m.cost_center_id is not null
         group by 1, 2)
       select t.cost_center_id, t.company_id, t.saldo, x.centro, x.empreendimento
       from t cross join lateral (
         select m2.cost_center_name as centro, m2.nome_comercial as empreendimento
         from public.mv_parcelas_receber m2 where m2.cost_center_id = t.cost_center_id limit 1) x
       order by 1`));
  const busca = a.busca ? String(a.busca).toLowerCase() : null;
  return {
    status: "ok",
    centros_de_custo: linhas
      .filter((l) => (!a.empresa || l.company_id === a.empresa) && (!busca || String(l.centro).toLowerCase().includes(busca)))
      .map((l) => ({
        "Cód. Centro de Custo": l.cost_center_id, "Centro de Custo": l.centro, "Cód. Empresa": l.company_id,
        Empreendimento: l.empreendimento, "Saldo a Receber Corrigido": moeda(l.saldo ?? 0),
      })),
  };
}

function listarColunas(a: Args, ctx: Contexto) {
  const visao = (a.visao as string) ?? "a_receber";
  const v: Visao = visao === "recebido" ? "baixa" : "parcela";
  const lista = catalogo(v).filter((c) =>
    ctx.perfil !== "externo" || !SENSIVEIS.some((s) => COLUNAS.find((x) => x.id === s)?.nome === c.coluna)
  );
  return { status: "ok", visao, colunas: lista };
}

export async function executar(nome: string, args: Args, ctx: Contexto) {
  switch (nome) {
    case "totais_receber": return await totais(args, ctx);
    case "consultar_receber": return await consultar(args, ctx);
    case "detalhe_receber": return await detalhe(args, ctx);
    case "listar_empresas": return await listarEmpresas(args);
    case "listar_centros_custo": return await listarCentros(args);
    case "listar_colunas": return listarColunas(args, ctx);
    case "exportar_receber": {
      validarPerfil(args as Filtros, ctx);
      return await exportar(args, ctx, "receber");
    }
    case "status_exportacao": return await statusExportacao(String(args.codigo), ctx);
    default: throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}
