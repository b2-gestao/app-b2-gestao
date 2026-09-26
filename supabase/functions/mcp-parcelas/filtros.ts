// Regras de negócio dos filtros + texto "filtros_aplicados" que o Claude repassa ao usuário.
import { dataBR, type Visao } from "./colunas.ts";

// Tipos de baixa que contam como dinheiro/valor que efetivamente entrou.
export const TIPOS_CAIXA = ["Recebimento", "Adiantamento", "Por Bens", "Bonificação"];
// Compensação: quita a parcela, mas o dinheiro já entrou quando o adiantamento foi baixado.
// Nunca soma nos totais; aparece nas listas e exportações com aviso.
export const TIPO_COMPENSACAO = "Abatimento de Adiantamento";
// Ajustes de saldo: aparecem no detalhe, mas ficam fora do "recebido" padrão.
export const TIPOS_AJUSTE = [
  "Reparcelamento", "Distrato", "Cancelamento", "Repactuação", "Estorno",
  "Outros", "Outros com Resíduo", "Promoção",
];
const TODOS_TIPOS = [...TIPOS_CAIXA, TIPO_COMPENSACAO, ...TIPOS_AJUSTE];

/** Aviso padrão sobre Abatimento de Adiantamento em listas/exportações (receber e pagar). */
export function avisoCompensacao(acao: "recebido" | "pago") {
  return `Inclui também as baixas de Abatimento de Adiantamento (categoria Compensação). Elas aparecem na lista/arquivo, ` +
    `mas NÃO entram no cálculo do ${acao}, porque o adiantamento já foi ${acao === "pago" ? "pago" : "recebido"} antes.`;
}

export interface OpcoesFiltro {
  /** true em consultar/exportar: traz as linhas de Abatimento de Adiantamento junto. */
  listagem?: boolean;
}

export type VisaoNegocio = "a_receber" | "recebido" | "todas";

export interface Filtros {
  visao?: VisaoNegocio;
  contrato?: string;
  empresa?: number | number[];
  empreendimento?: string;
  centro_custo?: number | number[];
  cliente?: string;
  unidade?: string;
  vencimento_de?: string;
  vencimento_ate?: string;
  pagamento_de?: string;
  pagamento_ate?: string;
  tipo_parcela?: string[];
  grupo_parcela?: "Financiamento" | "Permuta" | "Bens";
  tipos_recebimento?: string[];
  incluir_ajustes?: boolean;
}

// Esquema JSON reaproveitado pelas ferramentas.
export const ESQUEMA_FILTROS = {
  visao: {
    type: "string", enum: ["a_receber", "recebido", "todas"],
    description: "a_receber = parcelas com saldo em aberto (padrão). recebido = baixas já realizadas, pela data de pagamento. todas = todas as parcelas, sem filtro de situação.",
  },
  contrato: { type: "string", description: "Nº do contrato de venda (ex.: 22191/205). Filtra as parcelas do título financeiro ligado a esse contrato — use isso em vez de empreendimento/unidade quando o usuário citar um número de contrato." },
  empresa: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) da empresa (Cód. Empresa)" },
  empreendimento: { type: "string", description: "Nome (ou parte) do empreendimento" },
  centro_custo: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) do centro de custo" },
  cliente: { type: "string", description: "Nome (ou parte) do cliente" },
  unidade: { type: "string", description: "Unidade (ou parte)" },
  vencimento_de: { type: "string", format: "date", description: "Vencimento a partir de (AAAA-MM-DD)" },
  vencimento_ate: { type: "string", format: "date", description: "Vencimento até (AAAA-MM-DD)" },
  pagamento_de: { type: "string", format: "date", description: "Só na visão recebido: pagamento a partir de (AAAA-MM-DD)" },
  pagamento_ate: { type: "string", format: "date", description: "Só na visão recebido: pagamento até (AAAA-MM-DD)" },
  tipo_parcela: { type: "array", items: { type: "string" }, description: "Siglas ou descrições do tipo de parcela (ex.: PM, FI, 'Parcelas Mensais')" },
  grupo_parcela: { type: "string", enum: ["Financiamento", "Permuta", "Bens"], description: "Financiamento = FI; Permuta = PT, PE, PR, PN; Bens = BE, BM, BI" },
  tipos_recebimento: {
    type: "array", items: { type: "string", enum: TODOS_TIPOS },
    description: "Só na visão recebido. Padrão: Recebimento, Adiantamento, Por Bens, Bonificação. Use ['Por Bens'] para 'quanto recebi de bens'.",
  },
  incluir_ajustes: { type: "boolean", description: "Só na visão recebido: inclui também os ajustes (Distrato, Reparcelamento etc.). Use só se o usuário pedir." },
} as const;

export interface FiltroMontado {
  visao: string; // a_receber | recebido | todas (receber) ou a_pagar | pago | todas (pagar)
  linha: Visao; // parcela ou baixa
  from: string;
  where: string[];
  params: unknown[];
  campoData: string; // data usada em períodos/agrupamentos
  aplicados: string[]; // descrição em português
  avisos: string[];
}

const lista = <T>(v: T | T[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const dataValida = (s?: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

export function montarFiltro(f: Filtros = {}, opcoes: OpcoesFiltro = {}): FiltroMontado {
  const visao: VisaoNegocio = f.visao ?? "a_receber";
  const linha: Visao = visao === "recebido" ? "baixa" : "parcela";
  const where: string[] = [];
  const params: unknown[] = [];
  const aplicados: string[] = [];
  const avisos: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  for (const d of [f.vencimento_de, f.vencimento_ate, f.pagamento_de, f.pagamento_ate]) {
    if (!dataValida(d)) throw new Error(`Data inválida: ${d}. Use AAAA-MM-DD.`);
  }

  let from: string;
  let campoData: string;
  if (linha === "baixa") {
    from = `public.parcelas_receber_receipts r
      join public.mv_parcelas_receber m
        on m.bill_id = r.bill_id and m.installment_id = r.installment_id and m.payment_term_id = r.payment_term_id`;
    campoData = "r.payment_date";
    let tipos: string[];
    if (f.incluir_ajustes) {
      tipos = TODOS_TIPOS;
      aplicados.push("Tipos de recebimento: TODOS, inclusive ajustes de saldo (pedido do usuário)");
    } else if (f.tipos_recebimento?.length) {
      tipos = f.tipos_recebimento.map((t) => TODOS_TIPOS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t);
      aplicados.push(`Tipos de recebimento considerados: ${tipos.join(", ")}`);
    } else {
      tipos = opcoes.listagem ? [...TIPOS_CAIXA, TIPO_COMPENSACAO] : TIPOS_CAIXA;
      aplicados.push(`Tipos de recebimento considerados (padrão, entradas de caixa): ${TIPOS_CAIXA.join(", ")}`);
      if (opcoes.listagem) aplicados.push(avisoCompensacao("recebido"));
      else aplicados.push(`Abatimento de Adiantamento fica fora do total: o adiantamento já foi recebido antes`);
      aplicados.push(`Excluídos por padrão por serem ajustes de saldo, não entrada de caixa: ${TIPOS_AJUSTE.join(", ")}`);
    }
    where.push(`r.operation_type_name = any(${p(tipos)}::text[])`);
    aplicados.unshift("Visão: valores RECEBIDOS, pela data de pagamento (Valor Pago = valor líquido da baixa)");
    if (f.pagamento_de) { where.push(`r.payment_date >= ${p(f.pagamento_de)}::date`); }
    if (f.pagamento_ate) { where.push(`r.payment_date <= ${p(f.pagamento_ate)}::date`); }
    if (f.pagamento_de || f.pagamento_ate) {
      aplicados.push(`Período de pagamento: ${dataBR(f.pagamento_de) ?? "início"} a ${dataBR(f.pagamento_ate) ?? "hoje"}`);
    } else {
      aplicados.push("Período de pagamento: sem limite (todo o histórico)");
    }
  } else {
    from = "public.mv_parcelas_receber m";
    campoData = "m.due_date";
    if (visao === "a_receber") {
      where.push("m.saldo_aberto > 0");
      aplicados.push("Visão: valores A RECEBER — só parcelas com saldo em aberto maior que zero, pela data de vencimento");
      aplicados.push("Valor a receber = Saldo em Aberto Corrigido (parcelas distratadas, canceladas ou reparceladas ficam de fora porque não têm saldo)");
    } else {
      aplicados.push("Visão: TODAS as parcelas (recebidas e a receber), pela data de vencimento");
    }
    if (opcoes.listagem) {
      aplicados.push("A coluna Tipo Recebimento pode listar Abatimento de Adiantamento; esse valor não entra em Valor Pago " +
        "(o adiantamento já foi recebido antes)");
    }
    if (f.pagamento_de || f.pagamento_ate || f.tipos_recebimento || f.incluir_ajustes) {
      avisos.push("Filtros de pagamento/tipo de recebimento só valem na visão 'recebido' e foram ignorados.");
    }
  }

  const empresas = lista(f.empresa);
  if (empresas.length) { where.push(`m.company_id = any(${p(empresas)}::int[])`); aplicados.push(`Empresa(s): ${empresas.join(", ")}`); }
  const ccs = lista(f.centro_custo);
  if (ccs.length) { where.push(`m.cost_center_id = any(${p(ccs)}::int[])`); aplicados.push(`Centro(s) de custo: ${ccs.join(", ")}`); }
  if (f.empreendimento) { where.push(`m.nome_comercial ilike ${p(`%${f.empreendimento}%`)}`); aplicados.push(`Empreendimento contém: "${f.empreendimento}"`); }
  if (f.cliente) { where.push(`m.client_name ilike ${p(`%${f.cliente}%`)}`); aplicados.push(`Cliente contém: "${f.cliente}"`); }
  if (f.unidade) { where.push(`m.main_unit ilike ${p(`%${f.unidade}%`)}`); aplicados.push(`Unidade contém: "${f.unidade}"`); }
  if (f.contrato) {
    where.push(`m.bill_id = (select cv.receivable_bill_id from public.contratos_vendas cv where cv.number = ${p(f.contrato)})`);
    aplicados.push(`Contrato: ${f.contrato} (se o número não existir, o recorte fica vazio — confira em detalhe_contrato)`);
  }
  if (f.vencimento_de) where.push(`m.due_date >= ${p(f.vencimento_de)}::date`);
  if (f.vencimento_ate) where.push(`m.due_date <= ${p(f.vencimento_ate)}::date`);
  if (f.vencimento_de || f.vencimento_ate) {
    aplicados.push(`Período de vencimento: ${dataBR(f.vencimento_de) ?? "início"} a ${dataBR(f.vencimento_ate) ?? "sem limite"}`);
  } else if (linha === "parcela") {
    aplicados.push("Período de vencimento: sem limite");
  }
  if (f.tipo_parcela?.length) {
    where.push(`m.payment_term_id in (select payment_term_id from public.payment_term_descriptions
      where lower(payment_term_id) = any(${p(f.tipo_parcela.map((t) => t.toLowerCase()))}::text[])
         or lower(descricao) = any($${params.length}::text[]))`);
    aplicados.push(`Tipo de parcela: ${f.tipo_parcela.join(", ")}`);
  }
  if (f.grupo_parcela) {
    where.push(`m.grupo_parcela = ${p(f.grupo_parcela)}`);
    const siglas = { Financiamento: "FI", Permuta: "PT, PE, PR, PN", Bens: "BE, BM, BI" }[f.grupo_parcela];
    aplicados.push(`Grupo de parcela: ${f.grupo_parcela} (siglas ${siglas})`);
  }

  return { visao, linha, from, where, params, campoData, aplicados, avisos };
}

export const whereSql = (f: FiltroMontado) => (f.where.length ? `where ${f.where.join(" and ")}` : "");

// ---------------------------------------------------------------- paginação por keyset
// Chave de ordenação ÚNICA por linha. Na tabela de recebimentos a chave_gerada identifica a
// parcela (não a baixa) e uma mesma sequência pode ter mais de um tipo de operação, por isso
// a chave da baixa combina vários campos (verificado: 981.587 linhas, todas distintas assim).
export type Ordem = [string, string][]; // [expressão SQL, tipo do cast]

export const ORDEM_RECEBER: Record<Visao, Ordem> = {
  parcela: [["coalesce(m.due_date, '1900-01-01')", "date"], ["m.chave_gerada", "text"]],
  baixa: [
    ["r.payment_date", "date"], ["r.chave_gerada", "text"], ["r.receipt_sequencial_number", "int"],
    ["coalesce(r.operation_type_id, 0)", "int"], ["coalesce(r.gross_amount, 0)", "numeric"],
    ["coalesce(r.net_amount, 0)", "numeric"],
  ],
};

/** Monta ORDER BY, colunas de cursor (_o0.._oN) e a condição "depois do cursor". */
export function keyset(ordem: Ordem, params: unknown[], cursor: string[] | null) {
  const select = ordem.map(([e], i) => `(${e})::text as _o${i}`).join(", ");
  const orderBy = ordem.map(([e]) => e).join(", ");
  let cond: string | null = null;
  if (cursor) {
    if (cursor.length !== ordem.length) throw new Error("Cursor inválido para esta consulta.");
    const ph = cursor.map((valor, i) => { params.push(valor); return `$${params.length}::${ordem[i][1]}`; });
    cond = `(${orderBy}) > (${ph.join(", ")})`;
  }
  const extrair = (linha: Record<string, unknown>) => ordem.map((_, i) => String(linha[`_o${i}`]));
  return { select, orderBy, cond, extrair };
}
