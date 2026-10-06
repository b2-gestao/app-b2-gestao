// Edge Function: app-nf
//
// Notas Fiscais › Cadastros: cadastro de nota fiscal de compra no Sienge a partir do PDF
// (NF-e, NFS-e, boleto ou fatura). Portado do projeto sienge-nf-automatica (Next.js), com as
// mesmas regras; as rotas /api/* viraram ações desta função.
// Notas Fiscais › Título a Pagar: cadastro direto do título do contas a pagar (ações titulo_*).
// Chamada com o token do usuário logado (verify_jwt = true). As ações da nota exigem
// notas.cadastros (editar) no perfil, as titulo_* exigem notas.titulos (editar) e
// liberar_vencimento aceita qualquer uma das duas; o perfil de sistema (Administrador) sempre pode.
//
// Segredos (Edge Functions › Secrets):
//   SIENGE_API_USER / SIENGE_API_PASSWORD  usuário do Painel de Integrações (não é o login comum)
//   SIENGE_SUBDOMAIN                        tenant (padrão habitatpn)
//   SIENGE_FORMATO_PEDIDO                   SEQUENCIAL (padrão) ou ANUAL — parâmetro 415 do Sienge
//   SIENGE_DOCUMENT_ID_NFE/_NFSE/_BOLETO/_FATURA  código do documento (padrões NFE, NFSE, BOL, FAT)
//   SIENGE_MOVEMENT_TYPE_ID                 opcional; vazio usa o parâmetro 96
//   NF_EXTRACAO_PROVIDER                    openai (padrão) ou gemini
//   GEMINI_API_KEY, GEMINI_MODEL, GEMINI_THINKING_LEVEL
//   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_REASONING_EFFORT
//   NF_TOLERANCIA_VALOR                     fração para marcar todos os insumos (padrão 0.01)
//   NF_SENHA_VENCIMENTO                     libera a edição manual do vencimento; sem ela, fica travado
//   SIENGE_INDEX_ID_TITULO                  indexador dos títulos a pagar (padrão 0, sem correção)
//
// Ações ({ acao, ... }):
//   analisar            { pdfBase64 }                         → AnaliseDocumento (lê o PDF; nada é gravado)
//   pedidos             { documento, empresaId }              → AnaliseDocumento com a empresa informada pelo usuário (não relê o PDF)
//   preview             { documento, purchaseOrderId, empresaId? } → PreviewNota + documentos do Sienge (nada é gravado)
//   liberar_vencimento  { senha }                             → { ok }
//   cadastrar           ConfirmacaoCorpo (documentId opcional) → ConfirmacaoResultado (grava no Sienge + histórico)
//   anexar              { billId, pdfBase64, nomeArquivo, descricao, cadastroId? } → { ok }
//   titulo_analisar     { pdfBase64 }                         → AnaliseTitulo + documentos e planos financeiros
//   titulo_empresa      { documento, empresaId }              → AnaliseTitulo com a empresa informada pelo usuário
//   titulo_cadastrar    TituloCorpo                           → TituloResultado (grava no Sienge + histórico)
//   titulo_anexar       { billId, pdfBase64, nomeArquivo, descricao, tituloId? } → { ok }
//   sincronizar         {}                                        → { verificadas, excluidas, falhas } (confere no Sienge se as notas
//                        do histórico ainda existem e marca as excluídas; só pelo pg_cron, com o segredo do cabeçalho
//                        x-app-nf-sync conferido em app_nf_sync_segredo())

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ErroAplicacao, ErroHttpSienge, senhaVencimento, anexarNoTitulo, buscarNotaFiscalParaSincronizar, configSienge, DIAS_VENCIMENTO } from "./sienge.ts";
import type { TipoDocumento } from "./sienge.ts";
import { extrairDocumento, notaFiscalExtraidaSchema, TIPOS_DOCUMENTO } from "./extracao.ts";
import {
  buscarPedidosDoDocumento,
  confirmarCadastro,
  dataIsoValida,
  hojeBrasil,
  MAX_DESCRICAO_ANEXO,
  montarPreview,
  SIGLAS_ANEXO,
  somarDias,
} from "./regras.ts";
import type { ConfirmacaoRequest, ContextoCadastro } from "./regras.ts";
import {
  analisarTitulo,
  confirmarTitulo,
  MAX_APROPRIACOES,
  MAX_OBSERVACAO_TITULO,
  MAX_PARCELAS,
  MAX_VALOR_TITULO,
} from "./titulos.ts";
import type { AnaliseTitulo, ContextoTitulo, TituloRequest } from "./titulos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;

/** Cliente com o token do usuário: as RPCs respeitam o perfil e as empresas liberadas. */
function clienteDoUsuario(auth: string) {
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
}
type Cliente = ReturnType<typeof clienteDoUsuario>;

const PERMISSAO = "notas.cadastros";
const PERMISSAO_TITULOS = "notas.titulos";

/** Permissões (editar) aceitas por ação: basta uma delas. */
function permissoesDaAcao(acao: unknown): string[] {
  if (typeof acao === "string" && acao.startsWith("titulo_")) return [PERMISSAO_TITULOS];
  if (acao === "liberar_vencimento") return [PERMISSAO, PERMISSAO_TITULOS];
  return [PERMISSAO];
}
/** PDF de até ~3 MB (base64 cresce ~33%). */
const MAX_BASE64 = 4_000_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function invalido(mensagem: string): never {
  throw new ErroAplicacao("requisicao_invalida", mensagem, 400);
}

function limparBase64(valor: unknown): string {
  if (typeof valor !== "string" || !valor.trim()) invalido("Envie o PDF em pdfBase64.");
  const semPrefixo = valor.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
  if (semPrefixo.length > MAX_BASE64) throw new ErroAplicacao("requisicao_invalida", "O PDF é grande demais (limite de aproximadamente 3 MB).", 413);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(semPrefixo)) invalido("pdfBase64 não é um base64 válido.");
  return semPrefixo;
}

function bytesDoBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function textoObrigatorio(valor: unknown, campo: string): string {
  const texto = typeof valor === "string" || typeof valor === "number" ? String(valor).trim() : "";
  if (!texto) invalido(`Informe ${campo}.`);
  return texto;
}

async function resumo(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

/** Compara em tempo constante para não vazar o segredo por tempo de resposta. */
async function segredoIgual(recebido: unknown, esperado: string | null | undefined): Promise<boolean> {
  if (!esperado || typeof recebido !== "string" || !recebido) return false;
  const [a, b] = await Promise.all([resumo(recebido), resumo(esperado)]);
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

function senhaVencimentoCorreta(recebida: unknown): Promise<boolean> {
  return segredoIgual(recebida, senhaVencimento());
}

function data(valor: unknown, campo: string): string {
  if (!dataIsoValida(valor)) invalido(`Informe ${campo} válida (yyyy-MM-dd).`);
  return valor;
}

/** Padrão: hoje + DIAS_VENCIMENTO dias corridos. Data manual só com a senha correta. */
async function vencimento(manual: unknown): Promise<string> {
  const padrao = somarDias(hojeBrasil(), DIAS_VENCIMENTO);
  if (manual === undefined || manual === null) return padrao;
  const { data: escolhida, senha } = manual as Record<string, unknown>;
  if (!(await senhaVencimentoCorreta(senha))) throw new ErroAplicacao("senha_invalida", "Senha incorreta para alterar o vencimento.", 403);
  const valida = data(escolhida, "a data de vencimento");
  if (valida < hojeBrasil()) invalido("O vencimento não pode ser anterior a hoje.");
  return valida;
}

/** Documentos do Sienge para o seletor (app_nf_documentos). Lista vazia em erro: a tela usa os do tipo. */
const CACHE_DOCUMENTOS_MS = 30 * 60_000;
let cacheDocumentos: { em: number; lista: Array<{ id: string; nome: string }> } | null = null;

async function documentosSienge(cliente: Cliente): Promise<Array<{ id: string; nome: string }>> {
  if (cacheDocumentos && Date.now() - cacheDocumentos.em < CACHE_DOCUMENTOS_MS) return cacheDocumentos.lista;
  const { data, error } = await cliente.rpc("app_nf_documentos");
  if (error) {
    console.error("app_nf_documentos:", error.message);
    return [];
  }
  cacheDocumentos = { em: Date.now(), lista: (data ?? []) as Array<{ id: string; nome: string }> };
  return cacheDocumentos.lista;
}

/** Código do documento no Sienge (até 4 caracteres, ex.: NFSE, BOL); ausente usa o padrão do tipo. */
function codigoDocumento(valor: unknown, tipo: TipoDocumento): string {
  if (valor === undefined || valor === null || valor === "") return configSienge().documentIds[tipo];
  const codigo = typeof valor === "string" ? valor.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{1,4}$/.test(codigo)) invalido("Código de documento do Sienge inválido.");
  return codigo;
}

/** Código da empresa informado manualmente; ausente ou inválido vira null. */
function codigoEmpresa(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Planos financeiros já usados nos títulos sincronizados (app_planos_financeiros). Lista vazia em erro: a tela aceita o código digitado. */
let cachePlanos: { em: number; lista: Array<{ id: string; nome: string }> } | null = null;

async function planosFinanceiros(cliente: Cliente): Promise<Array<{ id: string; nome: string }>> {
  if (cachePlanos && Date.now() - cachePlanos.em < CACHE_DOCUMENTOS_MS) return cachePlanos.lista;
  const { data, error } = await cliente.rpc("app_planos_financeiros");
  if (error) {
    console.error("app_planos_financeiros:", error.message);
    return [];
  }
  cachePlanos = { em: Date.now(), lista: (data ?? []) as Array<{ id: string; nome: string }> };
  return cachePlanos.lista;
}

function numeroFinito(valor: unknown, campo: string): number {
  const numero = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() ? Number(valor) : NaN;
  if (!Number.isFinite(numero)) invalido(`Informe ${campo}.`);
  return numero;
}

/** Até 2 casas decimais, como o Sienge aceita nos valores do título. */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

async function validarTitulo(corpo: Record<string, unknown>): Promise<TituloRequest> {
  const fornecedorId = Number(corpo.fornecedorId);
  if (!Number.isInteger(fornecedorId) || fornecedorId <= 0) invalido("Credor inválido.");
  const empresaId = Number(corpo.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) invalido("Empresa inválida.");

  const tipoDocumento = corpo.tipoDocumento as TipoDocumento;
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) invalido("Tipo de documento inválido. Use NFE, NFSE, BOLETO ou FATURA.");

  const numero = textoObrigatorio(corpo.numero, "o número do documento");
  if (numero.length > 20) invalido("O número do documento pode ter no máximo 20 caracteres.");

  const valor = centavos(numeroFinito(corpo.valor, "o valor do título"));
  if (valor < 0.01 || valor > MAX_VALOR_TITULO) invalido("O valor do título deve ser maior que zero.");
  const desconto = corpo.desconto === undefined || corpo.desconto === null || corpo.desconto === "" ? 0 : centavos(numeroFinito(corpo.desconto, "o desconto"));
  if (desconto < 0 || desconto >= valor) invalido("O desconto deve ser maior ou igual a zero e menor que o valor do título.");

  const parcelas = Number(corpo.parcelas ?? 1);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) invalido(`O número de parcelas deve ser de 1 a ${MAX_PARCELAS}.`);

  if (!Array.isArray(corpo.apropriacoes) || corpo.apropriacoes.length === 0) invalido("Informe ao menos uma apropriação financeira.");
  if (corpo.apropriacoes.length > MAX_APROPRIACOES) invalido(`Informe no máximo ${MAX_APROPRIACOES} apropriações financeiras.`);
  const vistos = new Set<string>();
  const apropriacoes = (corpo.apropriacoes as unknown[]).map((bruto, i) => {
    const linha = (bruto ?? {}) as Record<string, unknown>;
    const costCenterId = Number(linha.centroCustoId);
    const paymentCategoriesId = typeof linha.planoFinanceiroId === "string" ? linha.planoFinanceiroId.trim() : "";
    const percentage = Number(linha.percentual);
    if (!Number.isInteger(costCenterId) || costCenterId <= 0) invalido(`Informe o centro de custo da apropriação ${i + 1}.`);
    if (!/^\d{1,20}$/.test(paymentCategoriesId)) invalido(`Informe o plano financeiro da apropriação ${i + 1} (só números, sem máscara).`);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) invalido(`O percentual da apropriação ${i + 1} deve ser maior que zero e até 100.`);
    const chave = `${costCenterId}|${paymentCategoriesId}`;
    if (vistos.has(chave)) invalido(`O centro de custo ${costCenterId} com o plano financeiro ${paymentCategoriesId} foi informado mais de uma vez.`);
    vistos.add(chave);
    return { costCenterId, paymentCategoriesId, percentage: Math.round(percentage * 10_000) / 10_000 };
  });
  const soma = apropriacoes.reduce((t, a) => t + a.percentage, 0);
  if (Math.abs(soma - 100) > 0.0001) invalido("A soma dos percentuais das apropriações deve ser 100%.");

  const dataEmissao = data(corpo.dataEmissao, "a data de emissão");
  const observacao = typeof corpo.observacao === "string" ? corpo.observacao.slice(0, MAX_OBSERVACAO_TITULO) : "";
  const descricao = typeof corpo.descricaoAnexo === "string" ? corpo.descricaoAnexo.trim() : "";

  return {
    fornecedorId,
    empresaId,
    tipoDocumento,
    documentId: codigoDocumento(corpo.documentId, tipoDocumento),
    numero,
    dataEmissao,
    dataCompetencia: data(corpo.dataCompetencia, "a data de competência"),
    dataBase: data(corpo.dataBase, "a data base"),
    vencimento: await vencimento(corpo.vencimentoManual),
    parcelas,
    valor,
    desconto,
    observacao,
    apropriacoes,
    pdfBase64: limparBase64(corpo.pdfBase64),
    nomeArquivo: typeof corpo.nomeArquivo === "string" ? corpo.nomeArquivo : "titulo.pdf",
    descricaoAnexo: (descricao || SIGLAS_ANEXO[tipoDocumento]).slice(0, MAX_DESCRICAO_ANEXO),
  };
}

async function validarConfirmacao(corpo: Record<string, unknown>): Promise<ConfirmacaoRequest> {
  const cabecalho = (corpo.cabecalho ?? {}) as Record<string, unknown>;

  const centroCustoId = Number(corpo.centroCustoId);
  if (!Number.isInteger(centroCustoId) || centroCustoId <= 0) invalido("Informe o código do centro de custo.");

  const numero = textoObrigatorio(cabecalho.numero, "o número do documento");
  if (numero.length > 20) invalido("O número do documento pode ter no máximo 20 caracteres.");

  const tipoDocumento = corpo.tipoDocumento as TipoDocumento;
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) invalido("Tipo de documento inválido. Use NFE, NFSE, BOLETO ou FATURA.");

  if (!Array.isArray(corpo.itens) || corpo.itens.length === 0) invalido("Selecione ao menos um insumo do pedido para vincular à nota.");
  const vistos = new Set<number>();
  const itens = (corpo.itens as unknown[]).map((bruto) => {
    const item = (bruto ?? {}) as Record<string, unknown>;
    const itemNumber = Number(item.itemNumber);
    const quantidade = Number(item.quantidade);
    if (!Number.isInteger(itemNumber)) invalido("Insumo do pedido inválido.");
    if (!Number.isFinite(quantidade) || quantidade <= 0) invalido(`A quantidade do insumo ${itemNumber} deve ser maior que zero.`);
    if (vistos.has(itemNumber)) invalido(`O insumo ${itemNumber} foi informado mais de uma vez.`);
    vistos.add(itemNumber);
    return { itemNumber, quantidade };
  });

  const serie = typeof cabecalho.serie === "string" && cabecalho.serie.trim() ? cabecalho.serie.trim() : null;
  const descricao = typeof corpo.descricaoAnexo === "string" ? corpo.descricaoAnexo.trim() : "";

  return {
    purchaseOrderId: textoObrigatorio(corpo.purchaseOrderId, "o número do pedido de compra"),
    tipoDocumento,
    documentId: codigoDocumento(corpo.documentId, tipoDocumento),
    pdfBase64: limparBase64(corpo.pdfBase64),
    nomeArquivo: typeof corpo.nomeArquivo === "string" ? corpo.nomeArquivo : "nota-fiscal.pdf",
    descricaoAnexo: (descricao || SIGLAS_ANEXO[tipoDocumento]).slice(0, MAX_DESCRICAO_ANEXO),
    centroCustoId,
    cabecalho: {
      numero,
      serie,
      dataEmissao: data(cabecalho.dataEmissao, "a data de emissão"),
      dataMovimento: data(cabecalho.dataMovimento, "a data de movimento"),
      vencimento: await vencimento(corpo.vencimentoManual),
      observacaoComplementar: typeof cabecalho.observacaoComplementar === "string" ? cabecalho.observacaoComplementar.slice(0, 2000) : "",
    },
    itens,
  };
}

/** Grava o histórico com a service_role. Falha aqui não desfaz a nota: só vai para o log. */
async function registrar(linha: Record<string, unknown>): Promise<string | null> {
  if (!admin) return null;
  const { data: gravada, error } = await admin.from("app_nf_cadastros").insert(linha).select("id").single();
  if (error) {
    console.error("app_nf_cadastros:", error.message);
    return null;
  }
  return gravada.id as string;
}

function linhaHistorico(
  usuario: { id: string; email?: string },
  entrada: ConfirmacaoRequest,
  contexto: ContextoCadastro,
  extra: { situacao: string; sequencial: number; billId: number | null; avisos: string[]; anexos: unknown[] },
  nomes: { fornecedor: unknown; empresa: unknown; valor: unknown },
) {
  return {
    criado_por: usuario.id,
    criado_por_email: usuario.email ?? null,
    situacao: extra.situacao,
    tipo_documento: entrada.tipoDocumento,
    documento_sienge: entrada.documentId,
    numero: entrada.cabecalho.numero,
    serie: entrada.cabecalho.serie,
    data_emissao: entrada.cabecalho.dataEmissao,
    data_movimento: entrada.cabecalho.dataMovimento,
    vencimento: entrada.cabecalho.vencimento,
    valor: typeof nomes.valor === "number" ? nomes.valor : null,
    fornecedor_id: contexto.fornecedorId,
    fornecedor_nome: typeof nomes.fornecedor === "string" ? nomes.fornecedor.slice(0, 200) : null,
    empresa_id: contexto.empresaId,
    empresa_nome: typeof nomes.empresa === "string" ? nomes.empresa.slice(0, 200) : null,
    pedido: contexto.pedidoExibicao,
    obra_nome: contexto.obraNome,
    sequencial: extra.sequencial,
    bill_id: extra.billId,
    itens: entrada.itens,
    avisos: extra.avisos,
    anexos: extra.anexos,
  };
}

/** Grava o histórico do título com a service_role. Falha aqui não desfaz o título: só vai para o log. */
async function registrarTitulo(
  usuario: { id: string; email?: string },
  entrada: TituloRequest,
  contexto: ContextoTitulo,
  resultado: { billId: number | null; avisos: string[] },
): Promise<string | null> {
  if (!admin) return null;
  const anexoFalhou = resultado.avisos.some((a) => a.startsWith("Não foi possível anexar"));
  const { data: gravada, error } = await admin.from("app_nf_titulos").insert({
    criado_por: usuario.id,
    criado_por_email: usuario.email ?? null,
    tipo_documento: entrada.tipoDocumento,
    documento_sienge: entrada.documentId,
    numero: entrada.numero,
    data_emissao: entrada.dataEmissao,
    data_competencia: entrada.dataCompetencia,
    vencimento: entrada.vencimento,
    parcelas: entrada.parcelas,
    valor: entrada.valor,
    desconto: entrada.desconto,
    fornecedor_id: entrada.fornecedorId,
    fornecedor_nome: contexto.fornecedorNome?.slice(0, 200) ?? null,
    empresa_id: entrada.empresaId,
    empresa_nome: contexto.empresaNome?.slice(0, 200) ?? null,
    bill_id: resultado.billId,
    apropriacoes: entrada.apropriacoes,
    avisos: resultado.avisos,
    anexos: [{ descricao: entrada.descricaoAnexo, nome: entrada.nomeArquivo, ok: !!resultado.billId && !anexoFalhou }],
  }).select("id").single();
  if (error) {
    console.error("app_nf_titulos:", error.message);
    return null;
  }
  return gravada.id as string;
}

/** Um arquivo por chamada no título já criado; registra o resultado na linha do histórico do mesmo título. */
async function anexarComHistorico(corpo: Record<string, unknown>, tabela: "app_nf_cadastros" | "app_nf_titulos", idHistorico: unknown) {
  const billId = Number(corpo.billId);
  if (!Number.isInteger(billId) || billId <= 0) invalido("Número do título inválido.");
  const pdfBase64 = limparBase64(corpo.pdfBase64);
  const nomeArquivo = textoObrigatorio(corpo.nomeArquivo, "o nome do arquivo");
  const descricao = textoObrigatorio(corpo.descricao, "a descrição do anexo");
  if (descricao.length > MAX_DESCRICAO_ANEXO) invalido(`A descrição do anexo pode ter no máximo ${MAX_DESCRICAO_ANEXO} caracteres.`);

  let falha: string | null = null;
  try {
    await anexarNoTitulo(billId, bytesDoBase64(pdfBase64), nomeArquivo, descricao);
  } catch (erro) {
    falha = erro instanceof Error ? erro.message : String(erro);
  }
  const id = typeof idHistorico === "string" ? idHistorico : "";
  if (admin && id) {
    const { data: atual } = await admin.from(tabela).select("anexos, bill_id").eq("id", id).maybeSingle();
    // Só registra no histórico do mesmo título.
    if (atual && atual.bill_id === billId) {
      const anexos = [...((atual.anexos as unknown[]) || []), { descricao, nome: nomeArquivo, ok: !falha, ...(falha ? { erro: falha } : {}) }];
      await admin.from(tabela).update({ anexos }).eq("id", id);
    }
  }
  if (falha) throw new ErroHttpSienge(502, falha, null);
  return json({ ok: true }, 201);
}

/** A análise do título leva junto as listas dos seletores (documentos e planos financeiros do Sienge). */
async function analiseComListas(analise: AnaliseTitulo, cliente: Cliente) {
  const [documentos, planos] = await Promise.all([documentosSienge(cliente), planosFinanceiros(cliente)]);
  return { ...analise, documentos, planos };
}

/** Segredo que autoriza o pg_cron a sincronizar (Vault app_nf_sync_key), lido pela service_role. */
const CACHE_SEGREDO_SYNC_MS = 5 * 60_000;
let cacheSegredoSync: { em: number; valor: string | null } | null = null;

async function segredoSincronizacao(): Promise<string | null> {
  if (!admin) return null;
  if (cacheSegredoSync && Date.now() - cacheSegredoSync.em < CACHE_SEGREDO_SYNC_MS) return cacheSegredoSync.valor;
  const { data, error } = await admin.rpc("app_nf_sync_segredo");
  if (error) {
    console.error("app_nf_sync_segredo:", error.message);
    return null;
  }
  cacheSegredoSync = { em: Date.now(), valor: typeof data === "string" && data ? data : null };
  return cacheSegredoSync.valor;
}

/** Notas conferidas por execução e consultas simultâneas ao Sienge (respeita o limite de requisições). */
const LOTE_SINCRONIZACAO = 100;
const PARALELO_SINCRONIZACAO = 5;

/**
 * Confere no Sienge se as notas do histórico ainda existem, das menos recentemente verificadas
 * para as mais. Só o 404 ou o código invalid.id do Sienge marca a nota como excluída; erro de rede ou do Sienge nunca marca.
 */
async function sincronizar(): Promise<{ verificadas: number; excluidas: number; falhas: number }> {
  const banco = admin;
  if (!banco) throw new ErroAplicacao("configuracao_invalida", "SUPABASE_SERVICE_ROLE_KEY não configurada.", 500);
  const { data: linhas, error } = await banco.from("app_nf_cadastros")
    .select("id, sequencial, bill_id")
    .is("excluida_no_sienge_em", null)
    .order("verificada_em", { ascending: true, nullsFirst: true })
    .limit(LOTE_SINCRONIZACAO);
  if (error) throw new Error(error.message);

  const resultado = { verificadas: 0, excluidas: 0, falhas: 0 };
  const conferir = async (linha: { id: string; sequencial: number; bill_id: number | null }) => {
    try {
      const nota = await buscarNotaFiscalParaSincronizar(linha.sequencial);
      const agora = new Date().toISOString();
      const alteracao: Record<string, unknown> = { verificada_em: agora };
      if (!nota) alteracao.excluida_no_sienge_em = agora;
      else if (nota.billId && nota.billId !== linha.bill_id) alteracao.bill_id = nota.billId;
      const { error: erroUpdate } = await banco.from("app_nf_cadastros").update(alteracao).eq("id", linha.id);
      if (erroUpdate) throw new Error(erroUpdate.message);
      resultado.verificadas++;
      if (!nota) resultado.excluidas++;
    } catch (erro) {
      resultado.falhas++;
      console.error("app-nf sincronizar:", linha.sequencial, erro instanceof Error ? erro.message : erro);
    }
  };
  for (let i = 0; i < (linhas ?? []).length; i += PARALELO_SINCRONIZACAO) {
    await Promise.all((linhas ?? []).slice(i, i + PARALELO_SINCRONIZACAO).map(conferir));
  }
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";

    // Chamada do pg_cron: o segredo do cabeçalho autoriza só a sincronização com o Sienge.
    const segredoRecebido = req.headers.get("x-app-nf-sync");
    if (segredoRecebido !== null) {
      if (!(await segredoIgual(segredoRecebido, await segredoSincronizacao()))) return json({ error: "Segredo de sincronização inválido." }, 403);
      const pedido = await req.json().catch(() => null);
      if (pedido?.acao !== "sincronizar") return json({ error: "Este acesso só executa a ação sincronizar." }, 403);
      return json(await sincronizar());
    }

    const cliente = clienteDoUsuario(auth);
    const { data: quem } = await cliente.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!quem?.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const usuario = { id: quem.user.id, email: quem.user.email };

    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      return json({ error: "O corpo da requisição não é um JSON válido." }, 400);
    }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return json({ error: "O corpo da requisição deve ser um objeto JSON." }, 400);

    const permissoes = permissoesDaAcao(corpo.acao);
    const respostas = await Promise.all(permissoes.map((p) => cliente.rpc("app_pode", { p_path: p, p_editar: true })));
    if (!respostas.some(({ data: pode, error }) => !error && pode === true)) {
      const titulo = permissoes.length === 1 && permissoes[0] === PERMISSAO_TITULOS;
      return json({ error: `Seu perfil não tem permissão para cadastrar ${titulo ? "títulos a pagar" : "notas fiscais"}.` }, 403);
    }

    switch (corpo.acao) {
      case "analisar": {
        const documento = await extrairDocumento(limparBase64(corpo.pdfBase64));
        return json(await buscarPedidosDoDocumento(documento));
      }

      case "pedidos": {
        const documento = notaFiscalExtraidaSchema.safeParse(corpo.documento);
        if (!documento.success) invalido("Envie o documento lido na análise em documento.");
        const empresaId = codigoEmpresa(corpo.empresaId);
        if (!empresaId) invalido("Informe o código da empresa.");
        return json(await buscarPedidosDoDocumento(documento.data, empresaId));
      }

      case "preview": {
        const documento = notaFiscalExtraidaSchema.safeParse(corpo.documento);
        if (!documento.success) invalido("Envie o documento lido na análise em documento.");
        const [preview, documentos] = await Promise.all([
          montarPreview({
            documento: documento.data,
            purchaseOrderId: textoObrigatorio(corpo.purchaseOrderId, "o número do pedido de compra"),
            vencimentoEditavel: !!senhaVencimento(),
            empresaId: codigoEmpresa(corpo.empresaId),
          }),
          documentosSienge(cliente),
        ]);
        return json({ ...preview, documentos });
      }

      case "liberar_vencimento": {
        // Confere a senha que libera a edição do vencimento. A gravação confere de novo.
        if (!(await senhaVencimentoCorreta(corpo.senha))) throw new ErroAplicacao("senha_invalida", "Senha incorreta.", 403);
        return json({ ok: true });
      }

      case "cadastrar": {
        const entrada = await validarConfirmacao(corpo);
        const nomes = { fornecedor: corpo.fornecedorNome, empresa: corpo.empresaNome, valor: corpo.valor };
        try {
          const { contexto, ...resultado } = await confirmarCadastro(entrada, bytesDoBase64(entrada.pdfBase64), async (empresaId) => {
            const { data, error } = await cliente.rpc("app_pode_empresa", { p_company: empresaId });
            return !error && data === true;
          });
          const anexoFalhou = resultado.avisos.some((a) => a.startsWith("Não foi possível anexar"));
          const cadastroId = await registrar(linhaHistorico(usuario, entrada, contexto, {
            situacao: "cadastrada",
            sequencial: resultado.sequentialNumber,
            billId: resultado.billId,
            avisos: resultado.avisos,
            anexos: [{ descricao: entrada.descricaoAnexo, nome: entrada.nomeArquivo, ok: !!resultado.billId && !anexoFalhou }],
          }, nomes));
          return json({ ...resultado, cadastroId }, 201);
        } catch (erro) {
          // Nota criada sem insumos: fica no histórico para o ajuste manual.
          if (erro instanceof ErroAplicacao && erro.codigo === "itens_nao_vinculados" && erro.detalhes) {
            await registrar(linhaHistorico(usuario, entrada, erro.detalhes.contexto as ContextoCadastro, {
              situacao: "itens_nao_vinculados",
              sequencial: erro.detalhes.sequentialNumber as number,
              billId: null,
              avisos: [erro.message],
              anexos: [],
            }, nomes));
            throw new ErroAplicacao(erro.codigo, erro.message, erro.status, { sequentialNumber: erro.detalhes.sequentialNumber });
          }
          throw erro;
        }
      }

      case "anexar":
        // Um arquivo por chamada: o Sienge também recebe um arquivo por requisição.
        return await anexarComHistorico(corpo, "app_nf_cadastros", corpo.cadastroId);

      case "titulo_analisar": {
        const documento = await extrairDocumento(limparBase64(corpo.pdfBase64));
        return json(await analiseComListas(await analisarTitulo(documento), cliente));
      }

      case "titulo_empresa": {
        const documento = notaFiscalExtraidaSchema.safeParse(corpo.documento);
        if (!documento.success) invalido("Envie o documento lido na análise em documento.");
        const empresaId = codigoEmpresa(corpo.empresaId);
        if (!empresaId) invalido("Informe o código da empresa.");
        return json(await analiseComListas(await analisarTitulo(documento.data, empresaId), cliente));
      }

      case "titulo_cadastrar": {
        const entrada = await validarTitulo(corpo);
        const { contexto, ...resultado } = await confirmarTitulo(entrada, bytesDoBase64(entrada.pdfBase64), async (empresaId) => {
          const { data, error } = await cliente.rpc("app_pode_empresa", { p_company: empresaId });
          return !error && data === true;
        });
        const tituloId = await registrarTitulo(usuario, entrada, contexto, resultado);
        return json({ ...resultado, tituloId }, 201);
      }

      case "titulo_anexar":
        return await anexarComHistorico(corpo, "app_nf_titulos", corpo.tituloId);

      default:
        return json({ error: "Ação desconhecida." }, 400);
    }
  } catch (erro) {
    if (erro instanceof ErroAplicacao) return json({ error: erro.message, codigo: erro.codigo, detalhes: erro.detalhes }, erro.status);
    if (erro instanceof ErroHttpSienge) return json({ error: erro.message, codigo: "erro_sienge" }, 502);
    console.error("app-nf:", erro);
    return json({ error: "Erro inesperado ao processar a nota fiscal.", codigo: "erro_sienge" }, 500);
  }
});
