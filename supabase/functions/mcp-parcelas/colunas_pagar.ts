// Dicionário de colunas do CONTAS A PAGAR: banco (inglês) -> usuário (português).
//   parcela -> 1 linha por parcela (view mv_parcelas_pagar, alias m) — só títulos de fato, sem previsões
//   baixa   -> 1 linha por pagamento/baixa (parcelas_pagar_payments p + view m)
import type { Coluna, Visao } from "./colunas.ts";

const ambas = (e: string) => ({ parcela: e, baixa: e });

// Valor LÍQUIDO = o que de fato se paga: original − impostos retidos − desconto do título
// (conferido nas baixas: net_amount do Sienge bate com essa conta). Só aritmética sobre colunas
// da própria view, sem join nem coluna nova.
// Saldo líquido = saldo corrigido × (líquido / original): igual ao líquido com a parcela toda em
// aberto e proporcional quando já houve pagamento parcial.
export const SQL_VALOR_LIQUIDO =
  "greatest(m.valor_original - coalesce(m.impostos_titulo, 0) - coalesce(m.desconto_titulo, 0), 0)";
export const SQL_SALDO_LIQUIDO =
  "greatest(coalesce(m.saldo_aberto_corrigido, 0) - coalesce(m.saldo_aberto_corrigido * (coalesce(m.impostos_titulo, 0) + coalesce(m.desconto_titulo, 0)) / nullif(m.valor_original, 0), 0), 0)";

export const COLUNAS_PAGAR: Coluna[] = [
  { id: "company_id", nome: "Cód. Empresa", descricao: "Código da empresa no Sienge", tipo: "numero", expr: ambas("m.company_id") },
  { id: "company_name", nome: "Empresa", descricao: "Razão social da empresa", tipo: "texto", expr: ambas("m.company_name") },
  { id: "nome_comercial", nome: "Empreendimento", descricao: "Nome comercial do empreendimento (de-para SharePoint)", tipo: "texto", expr: ambas("m.nome_comercial") },
  { id: "origem_nome_comercial", nome: "Origem do Nome", descricao: "Se o empreendimento veio do de-para por centro de custo, por empresa, ou se não há de-para", tipo: "texto", expr: ambas("m.origem_nome_comercial") },
  { id: "grupo", nome: "Grupo", descricao: "Grupo/responsável da empresa", tipo: "texto", expr: ambas("m.grupo") },
  { id: "cidade", nome: "Cidade", descricao: "Cidade do empreendimento", tipo: "texto", expr: ambas("m.cidade") },
  { id: "cost_center_id", nome: "Cód. Centro de Custo", descricao: "Centro de custo principal (maior percentual no rateio)", tipo: "numero", expr: ambas("m.cost_center_id") },
  { id: "cost_center_name", nome: "Centro de Custo", descricao: "Nome do centro de custo principal", tipo: "texto", expr: ambas("m.cost_center_name") },
  { id: "project_name", nome: "Obra", descricao: "Obra/projeto do título", tipo: "texto", expr: ambas("m.project_name") },
  { id: "creditor_id", nome: "Cód. Credor", descricao: "Código do credor (fornecedor)", tipo: "numero", expr: ambas("m.creditor_id") },
  { id: "creditor_name", nome: "Credor", descricao: "Nome do credor (fornecedor)", tipo: "texto", expr: ambas("m.creditor_name") },
  { id: "document_identification_name", nome: "Tipo Documento", descricao: "Tipo do documento (Nota Fiscal, Recibo, Contrato...)", tipo: "texto", expr: ambas("m.document_identification_name") },
  { id: "document_number", nome: "Nº Documento", descricao: "Número do documento", tipo: "texto", expr: ambas("m.document_number") },
  { id: "bill_id", nome: "Título", descricao: "Número do título no Sienge", tipo: "numero", expr: ambas("m.bill_id") },
  { id: "installment_id", nome: "Parcela", descricao: "Número da parcela no título", tipo: "numero", expr: ambas("m.installment_id") },
  { id: "issue_date", nome: "Emissão", descricao: "Data de emissão do documento", tipo: "data", expr: ambas("m.issue_date") },
  { id: "bill_date", nome: "Data do Título", descricao: "Data de cadastro do título", tipo: "data", expr: ambas("m.bill_date") },
  { id: "due_date", nome: "Vencimento", descricao: "Data de vencimento da parcela", tipo: "data", expr: ambas("m.due_date") },
  { id: "status_parcela", nome: "Status", descricao: "Em aberto, Paga, Cancelada, Substituída ou Baixada (outros)", tipo: "texto", expr: ambas("m.status_parcela") },
  { id: "valor_original", nome: "Valor Original", descricao: "Valor original da parcela", tipo: "moeda", expr: ambas("m.valor_original") },
  { id: "impostos_titulo", nome: "Impostos Retidos", descricao: "Impostos retidos no título (descontados do valor a pagar)", tipo: "moeda", expr: ambas("m.impostos_titulo") },
  { id: "desconto_titulo", nome: "Desconto do Título", descricao: "Desconto cadastrado no título (descontado do valor a pagar)", tipo: "moeda", expr: ambas("m.desconto_titulo") },
  { id: "valor_liquido", nome: "Valor Líquido", descricao: "Valor original − impostos retidos − desconto: o que de fato se paga", tipo: "moeda", expr: ambas(SQL_VALOR_LIQUIDO) },
  { id: "saldo_liquido", nome: "Saldo Líquido a Pagar", descricao: "Saldo em aberto já sem impostos retidos e desconto: o que de fato falta pagar", tipo: "moeda", expr: ambas(SQL_SALDO_LIQUIDO) },
  { id: "saldo_aberto", nome: "Saldo em Aberto", descricao: "Saldo em aberto sem correção", tipo: "moeda", expr: ambas("m.saldo_aberto") },
  { id: "saldo_aberto_corrigido", nome: "Saldo em Aberto Corrigido", descricao: "Saldo em aberto corrigido (bruto, ainda com impostos retidos)", tipo: "moeda", expr: ambas("m.saldo_aberto_corrigido") },
  // --- pagamento na visão parcela (agregados; valor pago = só saída de caixa)
  { id: "ultimo_pagamento", nome: "Data Pagamento", descricao: "Data do último pagamento/baixa que quitou", tipo: "data", expr: { parcela: "m.ultimo_pagamento" } },
  { id: "total_liquido_pago", nome: "Valor Pago", descricao: "Total líquido pago (Pagamento, Adiantamento, Por Bens)", tipo: "moeda", expr: { parcela: "m.total_liquido_pago" } },
  { id: "total_bruto_pago", nome: "Valor Bruto Pago", descricao: "Total bruto pago", tipo: "moeda", expr: { parcela: "m.total_bruto_pago" } },
  { id: "total_juros_multa", nome: "Juros e Multa", descricao: "Juros + multa pagos", tipo: "moeda", expr: { parcela: "m.total_juros_multa" } },
  { id: "total_desconto", nome: "Desconto", descricao: "Descontos obtidos", tipo: "moeda", expr: { parcela: "m.total_desconto" } },
  { id: "total_abatido_adiantamento", nome: "Abatido de Adiantamento", descricao: "Valor quitado por Abatimento de Adiantamento (não é saída de caixa: o adiantamento já foi pago)", tipo: "moeda", expr: { parcela: "m.total_abatido_adiantamento" } },
  { id: "tipo_pagamento", nome: "Tipo Baixa", descricao: "Tipos de baixa da parcela (Pagamento, Adiantamento, Abatimento...) com valores", tipo: "json", expr: { parcela: "m.tipo_pagamento" } },
  { id: "planos_financeiros", nome: "Planos Financeiros", descricao: "Planos financeiros do rateio (código, nome, percentual, centro de custo)", tipo: "json", expr: ambas("m.planos_financeiros") },
  { id: "apropriacoes_obra", nome: "Apropriação de Obra", descricao: "Obra, unidade, etapa e percentual apropriado", tipo: "json", expr: ambas("m.apropriacoes_obra") },
  // --- visão baixa (1 linha por pagamento)
  { id: "payment_date", nome: "Data Pagamento", descricao: "Data do pagamento/baixa", tipo: "data", expr: { baixa: "p.payment_date" } },
  { id: "operation_type_name", nome: "Tipo Baixa", descricao: "Tipo da baixa (Pagamento, Adiantamento, Abatimento de Adiantamento...)", tipo: "texto", expr: { baixa: "p.operation_type_name" } },
  { id: "categoria_pagamento", nome: "Categoria", descricao: "Saída de Caixa, Compensação (não soma) ou Ajuste (não soma)", tipo: "texto", expr: { baixa: "mcp.categoria_pagamento(p.operation_type_name)" } },
  { id: "net_amount", nome: "Valor Pago", descricao: "Valor líquido da baixa", tipo: "moeda", expr: { baixa: "p.net_amount" } },
  { id: "gross_amount", nome: "Valor Bruto", descricao: "Valor bruto da baixa", tipo: "moeda", expr: { baixa: "p.gross_amount" } },
  { id: "interest_fine", nome: "Juros e Multa", descricao: "Juros + multa da baixa", tipo: "moeda", expr: { baixa: "(coalesce(p.interest_amount,0)+coalesce(p.fine_amount,0))" } },
  { id: "discount_amount", nome: "Desconto", descricao: "Desconto da baixa", tipo: "moeda", expr: { baixa: "p.discount_amount" } },
  // --- demais
  { id: "authorization_status", nome: "Autorização", descricao: "Situação de autorização do título", tipo: "texto", expr: ambas("m.authorization_status") },
  { id: "indexer_name", nome: "Indexador", descricao: "Indexador de correção", tipo: "texto", expr: ambas("m.indexer_name") },
];

// Colunas padrão pedidas pelo administrador.
export const PADRAO_PAGAR: Record<Visao, string[]> = {
  parcela: [
    "company_id", "company_name", "nome_comercial", "cost_center_id",
    "creditor_id", "creditor_name", "document_identification_name", "document_number",
    "issue_date", "due_date", "status_parcela", "valor_original", "valor_liquido", "saldo_liquido",
    "ultimo_pagamento", "total_liquido_pago", "tipo_pagamento",
  ],
  baixa: [
    "company_id", "company_name", "nome_comercial", "cost_center_id",
    "creditor_id", "creditor_name", "document_identification_name", "document_number",
    "issue_date", "due_date", "payment_date", "operation_type_name", "categoria_pagamento", "net_amount",
  ],
};
