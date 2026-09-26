// Edge Function: app-nf
//
// Notas Fiscais › Cadastros: cadastro de nota fiscal de compra no Sienge a partir do PDF
// (NF-e, NFS-e, boleto ou fatura). Portado do projeto sienge-nf-automatica (Next.js), com as
// mesmas regras; as rotas /api/* viraram ações desta função.
// Chamada com o token do usuário logado (verify_jwt = true). Toda ação exige notas.cadastros
// (editar) no perfil; o perfil de sistema (Administrador) sempre pode.
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
//
// Ações ({ acao, ... }):
//   analisar            { pdfBase64 }                         → AnaliseDocumento (lê o PDF; nada é gravado)
//   preview             { documento, purchaseOrderId }        → PreviewNota (nada é gravado)
//   liberar_vencimento  { senha }                             → { ok }
//   cadastrar           ConfirmacaoCorpo                      → ConfirmacaoResultado (grava no Sienge + histórico)
//   anexar              { billId, pdfBase64, nomeArquivo, descricao, cadastroId? } → { ok }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ErroAplicacao, ErroHttpSienge, senhaVencimento, anexarNoTitulo, DIAS_VENCIMENTO } from "./sienge.ts";
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;

const PERMISSAO = "notas.cadastros";
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

/** Compara em tempo constante para não vazar a senha por tempo de resposta. */
async function senhaVencimentoCorreta(recebida: unknown): Promise<boolean> {
  const esperada = senhaVencimento();
  if (!esperada || typeof recebida !== "string" || !recebida) return false;
  const [a, b] = await Promise.all([resumo(recebida), resumo(esperada)]);
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const [{ data: pode, error: pErr }, { data: quem }] = await Promise.all([
      cliente.rpc("app_pode", { p_path: PERMISSAO, p_editar: true }),
      cliente.auth.getUser(auth.replace(/^Bearer\s+/i, "")),
    ]);
    if (pErr || pode !== true || !quem?.user) return json({ error: "Seu perfil não tem permissão para cadastrar notas fiscais." }, 403);
    const usuario = { id: quem.user.id, email: quem.user.email };

    let corpo: Record<string, unknown>;
    try {
      corpo = await req.json();
    } catch {
      return json({ error: "O corpo da requisição não é um JSON válido." }, 400);
    }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return json({ error: "O corpo da requisição deve ser um objeto JSON." }, 400);

    switch (corpo.acao) {
      case "analisar": {
        const documento = await extrairDocumento(limparBase64(corpo.pdfBase64));
        return json(await buscarPedidosDoDocumento(documento));
      }

      case "preview": {
        const documento = notaFiscalExtraidaSchema.safeParse(corpo.documento);
        if (!documento.success) invalido("Envie o documento lido na análise em documento.");
        return json(await montarPreview({
          documento: documento.data,
          purchaseOrderId: textoObrigatorio(corpo.purchaseOrderId, "o número do pedido de compra"),
          vencimentoEditavel: !!senhaVencimento(),
        }));
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
          const { contexto, ...resultado } = await confirmarCadastro(entrada, bytesDoBase64(entrada.pdfBase64));
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

      case "anexar": {
        // Um arquivo por chamada: o Sienge também recebe um arquivo por requisição.
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
        const cadastroId = typeof corpo.cadastroId === "string" ? corpo.cadastroId : "";
        if (admin && cadastroId) {
          const { data: atual } = await admin.from("app_nf_cadastros").select("anexos, bill_id").eq("id", cadastroId).maybeSingle();
          // Só registra no cadastro do mesmo título.
          if (atual && atual.bill_id === billId) {
            const anexos = [...((atual.anexos as unknown[]) || []), { descricao, nome: nomeArquivo, ok: !falha, ...(falha ? { erro: falha } : {}) }];
            await admin.from("app_nf_cadastros").update({ anexos }).eq("id", cadastroId);
          }
        }
        if (falha) throw new ErroHttpSienge(502, falha, null);
        return json({ ok: true }, 201);
      }

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
