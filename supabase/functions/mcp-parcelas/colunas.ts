// Dicionário de colunas: nome no banco (inglês) -> nome exibido ao usuário (português).
// O usuário nunca vê o nome em inglês: entrada e saída passam por aqui.
//
// Existem duas "visões" de linha:
//   parcela -> 1 linha por parcela (view mv_parcelas_receber, alias m)
//   baixa   -> 1 linha por recebimento/baixa (parcelas_receber_receipts r + view m)

export type Visao = "parcela" | "baixa";
export type Tipo = "texto" | "numero" | "moeda" | "data" | "json";

export interface Coluna {
  id: string; // identificador interno (nome da coluna no banco)
  nome: string; // nome em português exibido
  descricao: string;
  tipo: Tipo;
  expr: Partial<Record<Visao, string>>; // expressão SQL em cada visão
}

const ambas = (e: string) => ({ parcela: e, baixa: e });

export const COLUNAS: Coluna[] = [
  { id: "company_id", nome: "Cód. Empresa", descricao: "Código da empresa no Sienge", tipo: "numero", expr: ambas("m.company_id") },
  { id: "company_name", nome: "Empresa", descricao: "Razão social da empresa", tipo: "texto", expr: ambas("m.company_name") },
  { id: "nome_comercial", nome: "Empreendimento", descricao: "Nome comercial do empreendimento (de-para SharePoint)", tipo: "texto", expr: ambas("m.nome_comercial") },
  { id: "grupo", nome: "Grupo", descricao: "Grupo/responsável da empresa", tipo: "texto", expr: ambas("m.grupo") },
  { id: "cidade", nome: "Cidade", descricao: "Cidade do empreendimento", tipo: "texto", expr: ambas("m.cidade") },
  { id: "tipo_produto", nome: "Tipo de Produto", descricao: "Tipo de produto do empreendimento", tipo: "texto", expr: ambas("m.tipo_produto") },
  { id: "cost_center_id", nome: "Cód. Centro de Custo", descricao: "Código do centro de custo", tipo: "numero", expr: ambas("m.cost_center_id") },
  { id: "cost_center_name", nome: "Centro de Custo", descricao: "Nome do centro de custo", tipo: "texto", expr: ambas("m.cost_center_name") },
  { id: "project_name", nome: "Obra", descricao: "Nome da obra/projeto", tipo: "texto", expr: ambas("m.project_name") },
  { id: "main_unit", nome: "Unidade", descricao: "Unidade principal vendida", tipo: "texto", expr: ambas("m.main_unit") },
  { id: "client_id", nome: "Cód. Cliente", descricao: "Código do cliente", tipo: "numero", expr: ambas("m.client_id") },
  { id: "client_name", nome: "Cliente", descricao: "Nome do cliente", tipo: "texto", expr: ambas("m.client_name") },
  { id: "bill_id", nome: "Título", descricao: "Número do título no Sienge", tipo: "numero", expr: ambas("m.bill_id") },
  { id: "installment_id", nome: "Parcela", descricao: "Número da parcela dentro do título", tipo: "numero", expr: ambas("m.installment_id") },
  { id: "installment_number", nome: "Nº Parcela", descricao: "Número sequencial da parcela", tipo: "texto", expr: ambas("m.installment_number") },
  { id: "payment_term_id", nome: "Sigla Tipo Parcela", descricao: "Sigla da condição de pagamento (PM, FI, PT...)", tipo: "texto", expr: ambas("m.payment_term_id") },
  { id: "payment_term_description", nome: "Tipo Parcela", descricao: "Descrição da condição de pagamento (Parcelas Mensais, Financiamento Bancário...)", tipo: "texto", expr: ambas("m.payment_term_description") },
  { id: "grupo_parcela", nome: "Grupo Parcela", descricao: "Financiamento, Permuta, Bens ou vazio para as demais", tipo: "texto", expr: ambas("m.grupo_parcela") },
  { id: "due_date", nome: "Vencimento", descricao: "Data de vencimento da parcela", tipo: "data", expr: ambas("m.due_date") },
  { id: "issue_date", nome: "Emissão", descricao: "Data de emissão", tipo: "data", expr: ambas("m.issue_date") },
  { id: "status_parcela", nome: "Status", descricao: "Recebida ou A receber (considera só entradas de caixa)", tipo: "texto", expr: ambas("m.status_parcela") },
  { id: "valor_original", nome: "Valor Original", descricao: "Valor original da parcela", tipo: "moeda", expr: ambas("m.valor_original") },
  { id: "saldo_aberto", nome: "Saldo em Aberto", descricao: "Saldo em aberto sem correção", tipo: "moeda", expr: ambas("m.saldo_aberto") },
  { id: "saldo_aberto_corrigido", nome: "Saldo em Aberto Corrigido", descricao: "Saldo em aberto corrigido pelo índice", tipo: "moeda", expr: ambas("m.saldo_aberto_corrigido") },
  // --- campos de recebimento na visão parcela (agregados, só entradas de caixa)
  { id: "ultimo_recebimento", nome: "Data Pagamento", descricao: "Data do último recebimento (entradas de caixa)", tipo: "data", expr: { parcela: "m.ultimo_recebimento" } },
  { id: "primeiro_recebimento", nome: "Data Primeiro Pagamento", descricao: "Data do primeiro recebimento (entradas de caixa)", tipo: "data", expr: { parcela: "m.primeiro_recebimento" } },
  { id: "total_liquido_recebido", nome: "Valor Pago", descricao: "Total líquido recebido (entradas de caixa)", tipo: "moeda", expr: { parcela: "m.total_liquido_recebido" } },
  { id: "total_bruto_recebido", nome: "Valor Bruto Recebido", descricao: "Total bruto recebido (entradas de caixa)", tipo: "moeda", expr: { parcela: "m.total_bruto_recebido" } },
  { id: "total_juros_multa", nome: "Juros e Multa", descricao: "Juros + multa recebidos", tipo: "moeda", expr: { parcela: "m.total_juros_multa" } },
  { id: "total_desconto", nome: "Desconto", descricao: "Descontos concedidos", tipo: "moeda", expr: { parcela: "m.total_desconto" } },
  { id: "qtd_recebimentos", nome: "Qtd. Recebimentos", descricao: "Quantidade de baixas de entrada de caixa", tipo: "numero", expr: { parcela: "m.qtd_recebimentos" } },
  { id: "tipo_recebimento", nome: "Tipo Recebimento", descricao: "Tipos de baixa da parcela (Recebimento, Adiantamento, Por Bens...) com valores", tipo: "json", expr: { parcela: "m.tipo_recebimento" } },
  { id: "planos_financeiros", nome: "Planos Financeiros", descricao: "Planos financeiros do rateio (código, nome, percentual)", tipo: "json", expr: ambas("m.planos_financeiros") },
  { id: "conta_corrente", nome: "Conta Corrente", descricao: "Conta onde entrou o recebimento", tipo: "texto", expr: { parcela: "m.conta_corrente", baixa: "r.account_number" } },
  // --- campos da visão baixa (1 linha por recebimento)
  { id: "payment_date", nome: "Data Pagamento", descricao: "Data do recebimento/baixa", tipo: "data", expr: { baixa: "r.payment_date" } },
  { id: "operation_type_name", nome: "Tipo Recebimento", descricao: "Tipo da baixa (Recebimento, Adiantamento, Por Bens, Distrato...)", tipo: "texto", expr: { baixa: "r.operation_type_name" } },
  { id: "categoria_recebimento", nome: "Categoria", descricao: "Entrada de Caixa ou Ajuste", tipo: "texto", expr: { baixa: "mcp.categoria_operacao(r.operation_type_name)" } },
  { id: "net_amount", nome: "Valor Pago", descricao: "Valor líquido da baixa", tipo: "moeda", expr: { baixa: "r.net_amount" } },
  { id: "gross_amount", nome: "Valor Bruto", descricao: "Valor bruto da baixa", tipo: "moeda", expr: { baixa: "r.gross_amount" } },
  { id: "interest_fine", nome: "Juros e Multa", descricao: "Juros + multa da baixa", tipo: "moeda", expr: { baixa: "(coalesce(r.interest_amount,0)+coalesce(r.fine_amount,0))" } },
  { id: "discount_amount", nome: "Desconto", descricao: "Desconto da baixa", tipo: "moeda", expr: { baixa: "r.discount_amount" } },
  // --- demais campos da parcela
  { id: "defaulter_situation", nome: "Situação Inadimplência", descricao: "Situação de inadimplência", tipo: "texto", expr: ambas("m.defaulter_situation") },
  { id: "sub_judicie", nome: "Sub Judice", descricao: "Parcela em discussão judicial", tipo: "texto", expr: ambas("m.sub_judicie") },
  { id: "correction_type", nome: "Tipo de Correção", descricao: "Índice de correção", tipo: "texto", expr: ambas("m.correction_type") },
  { id: "document_identification_name", nome: "Tipo Documento", descricao: "Tipo do documento", tipo: "texto", expr: ambas("m.document_identification_name") },
  { id: "document_number", nome: "Nº Documento", descricao: "Número do documento", tipo: "texto", expr: ambas("m.document_number") },
];

// Colunas padrão pedidas pelo administrador: sempre vêm, salvo pedido contrário.
export const PADRAO: Record<Visao, string[]> = {
  parcela: [
    "company_id", "nome_comercial", "cost_center_id", "main_unit", "client_name",
    "due_date", "payment_term_id", "payment_term_description",
    "valor_original", "saldo_aberto_corrigido",
    "ultimo_recebimento", "total_liquido_recebido", "tipo_recebimento",
  ],
  baixa: [
    "company_id", "nome_comercial", "cost_center_id", "main_unit", "client_name",
    "due_date", "payment_term_id", "payment_term_description",
    "payment_date", "operation_type_name", "categoria_recebimento", "net_amount", "gross_amount",
  ],
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const disponiveis = (v: Visao, cols: Coluna[]) => cols.filter((c) => c.expr[v]);

/**
 * Resolve o pedido de colunas do usuário.
 * "padrao" (default) | "completo"/"todas" | lista de nomes (português ou do banco).
 * cols/padrao permitem usar o mesmo mecanismo para outra base (ex.: contas a pagar).
 */
export function resolverColunas(
  v: Visao, pedido?: string | string[], cols: Coluna[] = COLUNAS, padrao: Record<Visao, string[]> = PADRAO,
): { colunas: Coluna[]; desconhecidas: string[] } {
  if (!pedido || pedido === "padrao") {
    return { colunas: padrao[v].map((id) => cols.find((c) => c.id === id)!), desconhecidas: [] };
  }
  if (pedido === "completo" || pedido === "todas") return { colunas: disponiveis(v, cols), desconhecidas: [] };
  const lista = Array.isArray(pedido) ? pedido : pedido.split(",");
  const colunas: Coluna[] = [];
  const desconhecidas: string[] = [];
  for (const p of lista) {
    const n = normalizar(p);
    const c = disponiveis(v, cols).find((c) => normalizar(c.nome) === n || normalizar(c.id) === n);
    if (c) { if (!colunas.includes(c)) colunas.push(c); } else desconhecidas.push(p.trim());
  }
  return { colunas, desconhecidas };
}

/** Lista para a ferramenta listar_colunas. */
export function catalogo(v: Visao, cols: Coluna[] = COLUNAS, padrao: Record<Visao, string[]> = PADRAO) {
  return disponiveis(v, cols).map((c) => ({
    coluna: c.nome,
    descricao: c.descricao,
    padrao: padrao[v].includes(c.id),
  }));
}

// ---------------- formatação de saída ----------------

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const moeda = (v: unknown) => (v === null || v === undefined ? null : brl.format(Number(v)));
export const dataBR = (v: unknown) => {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
};

interface TipoRec { tipo: string; categoria: string; valor_liquido: number; ultima_data: string }

// Colunas JSON de tipos de baixa (receber e pagar) que vêm resumidas no perfil padrão.
const COLUNAS_TIPO_BAIXA = ["tipo_recebimento", "tipo_pagamento"];

/** Rótulo curto da categoria: deixa claro o que NÃO entra nos totais. */
function marcaCategoria(tipo: string, categoria: string) {
  if (tipo === "Abatimento de Adiantamento") return " (compensação: não soma, adiantamento já baixado)";
  if (categoria === "Ajuste") return " (ajuste: não soma)";
  return "";
}

/** Resume o JSON de tipos de baixa numa string curta (economiza tokens). */
function resumirTipos(v: unknown): string | null {
  if (!v) return null;
  const itens = (typeof v === "string" ? JSON.parse(v) : v) as TipoRec[];
  return itens
    .map((t) => `${t.tipo}${marcaCategoria(t.tipo, t.categoria)}: ${moeda(t.valor_liquido)} em ${dataBR(t.ultima_data)}`)
    .join(" | ");
}

/** Converte uma linha do banco (chaves = id) em linha com nomes em português. */
export function formatarLinha(linha: Record<string, unknown>, colunas: Coluna[], completo: boolean) {
  const saida: Record<string, unknown> = {};
  for (const c of colunas) {
    const v = linha[c.id];
    if (c.tipo === "moeda") saida[c.nome] = moeda(v);
    else if (c.tipo === "data") saida[c.nome] = dataBR(v);
    else if (COLUNAS_TIPO_BAIXA.includes(c.id)) saida[c.nome] = completo ? v : resumirTipos(v);
    else saida[c.nome] = v ?? null;
  }
  return saida;
}
