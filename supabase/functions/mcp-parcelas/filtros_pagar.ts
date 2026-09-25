// Regras de negócio do CONTAS A PAGAR + texto "filtros_aplicados".
// A view mv_parcelas_pagar já exclui títulos de previsão: tudo aqui é título de fato.
import { dataBR, type Visao } from "./colunas.ts";
import { avisoCompensacao, type FiltroMontado, type OpcoesFiltro, type Ordem, TIPO_COMPENSACAO } from "./filtros.ts";

// Saída de caixa: dinheiro que efetivamente saiu.
export const TIPOS_SAIDA = ["Pagamento", "Adiantamento", "Por Bens"];
// Ajustes: baixam o título sem pagamento.
export const TIPOS_AJUSTE_PAGAR = [
  "Cancelamento", "Substituição", "Outros", "Devolução", "Devolução de Nota Fiscal Paga", "Adiantamento por Devolução",
];
const TODOS = [...TIPOS_SAIDA, TIPO_COMPENSACAO, ...TIPOS_AJUSTE_PAGAR];
const STATUS = ["Em aberto", "Paga", "Cancelada", "Substituída", "Baixada (outros)"];

export type VisaoPagar = "a_pagar" | "pago" | "todas";

export interface FiltrosPagar {
  visao?: VisaoPagar;
  empresa?: number | number[];
  empreendimento?: string;
  centro_custo?: number | number[];
  credor?: string;
  cod_credor?: number | number[];
  tipo_documento?: string;
  status?: string[];
  vencimento_de?: string;
  vencimento_ate?: string;
  pagamento_de?: string;
  pagamento_ate?: string;
  emissao_de?: string;
  emissao_ate?: string;
  tipos_pagamento?: string[];
  incluir_ajustes?: boolean;
}

export const ESQUEMA_FILTROS_PAGAR = {
  visao: {
    type: "string", enum: ["a_pagar", "pago", "todas"],
    description: "a_pagar = parcelas com saldo em aberto (padrão). pago = baixas realizadas, pela data de pagamento. todas = todas as parcelas.",
  },
  empresa: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) da empresa (Cód. Empresa)" },
  empreendimento: { type: "string", description: "Nome (ou parte) do empreendimento" },
  centro_custo: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) do centro de custo" },
  credor: { type: "string", description: "Nome (ou parte) do credor/fornecedor" },
  cod_credor: { type: ["integer", "array"], items: { type: "integer" }, description: "Código(s) do credor" },
  tipo_documento: { type: "string", description: "Tipo de documento (ou parte): 'nota fiscal', 'recibo', 'contrato'..." },
  status: { type: "array", items: { type: "string", enum: STATUS }, description: "Só na visão todas: filtra pelo status da parcela" },
  vencimento_de: { type: "string", format: "date", description: "Vencimento a partir de (AAAA-MM-DD)" },
  vencimento_ate: { type: "string", format: "date", description: "Vencimento até (AAAA-MM-DD)" },
  emissao_de: { type: "string", format: "date", description: "Emissão a partir de (AAAA-MM-DD)" },
  emissao_ate: { type: "string", format: "date", description: "Emissão até (AAAA-MM-DD)" },
  pagamento_de: { type: "string", format: "date", description: "Só na visão pago: pagamento a partir de (AAAA-MM-DD)" },
  pagamento_ate: { type: "string", format: "date", description: "Só na visão pago: pagamento até (AAAA-MM-DD)" },
  tipos_pagamento: {
    type: "array", items: { type: "string", enum: TODOS },
    description: "Só na visão pago. Padrão: Pagamento, Adiantamento, Por Bens.",
  },
  incluir_ajustes: { type: "boolean", description: "Só na visão pago: inclui também cancelamentos, substituições e devoluções. Use só se o usuário pedir." },
} as const;

const lista = <T>(v: T | T[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const dataValida = (s?: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

export function montarFiltroPagar(f: FiltrosPagar = {}, opcoes: OpcoesFiltro = {}): FiltroMontado {
  const visao = f.visao ?? "a_pagar";
  const linha: Visao = visao === "pago" ? "baixa" : "parcela";
  const where: string[] = [];
  const params: unknown[] = [];
  const aplicados: string[] = ["Somente títulos de fato: títulos de previsão (contrato de medição, pedido de compra) não entram"];
  const avisos: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  for (const d of [f.vencimento_de, f.vencimento_ate, f.pagamento_de, f.pagamento_ate, f.emissao_de, f.emissao_ate]) {
    if (!dataValida(d)) throw new Error(`Data inválida: ${d}. Use AAAA-MM-DD.`);
  }

  let from: string;
  let campoData: string;
  if (linha === "baixa") {
    from = `public.parcelas_pagar_payments p join public.mv_parcelas_pagar m on m.chave_parcela = p.chave_parcela`;
    campoData = "p.payment_date";
    let tipos: string[];
    if (f.incluir_ajustes) {
      tipos = TODOS;
      aplicados.push("Tipos de baixa: TODOS, inclusive cancelamentos, substituições e devoluções (pedido do usuário)");
    } else if (f.tipos_pagamento?.length) {
      tipos = f.tipos_pagamento.map((t) => TODOS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t);
      aplicados.push(`Tipos de baixa considerados: ${tipos.join(", ")}`);
    } else {
      tipos = opcoes.listagem ? [...TIPOS_SAIDA, TIPO_COMPENSACAO] : TIPOS_SAIDA;
      aplicados.push(`Tipos de baixa considerados (padrão, saída de caixa): ${TIPOS_SAIDA.join(", ")}`);
      if (opcoes.listagem) aplicados.push(avisoCompensacao("pago"));
      else aplicados.push("Abatimento de Adiantamento fica fora do total: o adiantamento já foi pago antes");
      aplicados.push(`Excluídos por não serem pagamento: ${TIPOS_AJUSTE_PAGAR.join(", ")}`);
    }
    where.push(`p.operation_type_name = any(${p(tipos)}::text[])`);
    aplicados.unshift("Visão: valores PAGOS, pela data de pagamento (Valor Pago = valor líquido da baixa)");
    if (f.pagamento_de) where.push(`p.payment_date >= ${p(f.pagamento_de)}::date`);
    if (f.pagamento_ate) where.push(`p.payment_date <= ${p(f.pagamento_ate)}::date`);
    aplicados.push(f.pagamento_de || f.pagamento_ate
      ? `Período de pagamento: ${dataBR(f.pagamento_de) ?? "início"} a ${dataBR(f.pagamento_ate) ?? "hoje"}`
      : "Período de pagamento: sem limite (todo o histórico)");
    if (f.status?.length) avisos.push("Filtro de status só vale nas visões a_pagar/todas e foi ignorado.");
  } else {
    from = "public.mv_parcelas_pagar m";
    campoData = "m.due_date";
    if (visao === "a_pagar") {
      where.push("m.status_parcela = 'Em aberto'");
      aplicados.unshift("Visão: valores A PAGAR — parcelas com saldo em aberto, pela data de vencimento");
      aplicados.push("Valor a pagar = Saldo Líquido a Pagar (saldo em aberto − impostos retidos − desconto do título)");
    } else {
      aplicados.unshift("Visão: TODAS as parcelas (pagas, em aberto, canceladas...), pela data de vencimento");
      if (f.status?.length) {
        where.push(`m.status_parcela = any(${p(f.status)}::text[])`);
        aplicados.push(`Status: ${f.status.join(", ")}`);
      }
    }
    if (opcoes.listagem) {
      aplicados.push("A coluna Tipo Baixa pode listar Abatimento de Adiantamento; esse valor não entra em Valor Pago " +
        "(o adiantamento já foi pago antes) e aparece separado em 'Abatido de Adiantamento'");
    }
    if (f.pagamento_de || f.pagamento_ate || f.tipos_pagamento || f.incluir_ajustes) {
      avisos.push("Filtros de pagamento/tipo de baixa só valem na visão 'pago' e foram ignorados.");
    }
  }

  const empresas = lista(f.empresa);
  if (empresas.length) { where.push(`m.company_id = any(${p(empresas)}::int[])`); aplicados.push(`Empresa(s): ${empresas.join(", ")}`); }
  const ccs = lista(f.centro_custo);
  if (ccs.length) { where.push(`m.cost_center_id = any(${p(ccs)}::int[])`); aplicados.push(`Centro(s) de custo: ${ccs.join(", ")}`); }
  const credores = lista(f.cod_credor);
  if (credores.length) { where.push(`m.creditor_id = any(${p(credores)}::int[])`); aplicados.push(`Credor(es): ${credores.join(", ")}`); }
  if (f.credor) { where.push(`m.creditor_name ilike ${p(`%${f.credor}%`)}`); aplicados.push(`Credor contém: "${f.credor}"`); }
  if (f.empreendimento) { where.push(`m.nome_comercial ilike ${p(`%${f.empreendimento}%`)}`); aplicados.push(`Empreendimento contém: "${f.empreendimento}"`); }
  if (f.tipo_documento) { where.push(`m.document_identification_name ilike ${p(`%${f.tipo_documento}%`)}`); aplicados.push(`Tipo de documento contém: "${f.tipo_documento}"`); }
  if (f.vencimento_de) where.push(`m.due_date >= ${p(f.vencimento_de)}::date`);
  if (f.vencimento_ate) where.push(`m.due_date <= ${p(f.vencimento_ate)}::date`);
  if (f.vencimento_de || f.vencimento_ate) {
    aplicados.push(`Período de vencimento: ${dataBR(f.vencimento_de) ?? "início"} a ${dataBR(f.vencimento_ate) ?? "sem limite"}`);
  } else if (linha === "parcela") {
    aplicados.push("Período de vencimento: sem limite");
  }
  if (f.emissao_de) where.push(`m.issue_date >= ${p(f.emissao_de)}::date`);
  if (f.emissao_ate) where.push(`m.issue_date <= ${p(f.emissao_ate)}::date`);
  if (f.emissao_de || f.emissao_ate) {
    aplicados.push(`Período de emissão: ${dataBR(f.emissao_de) ?? "início"} a ${dataBR(f.emissao_ate) ?? "sem limite"}`);
  }

  return { visao, linha, from, where, params, campoData, aplicados, avisos };
}

// Paginação: na parcela a chave é única; na baixa, id do pagamento desempata.
export const ORDEM_PAGAR: Record<Visao, Ordem> = {
  parcela: [["coalesce(m.due_date, '1900-01-01')", "date"], ["m.chave_parcela", "text"]],
  baixa: [["p.payment_date", "date"], ["p.id", "bigint"]],
};
