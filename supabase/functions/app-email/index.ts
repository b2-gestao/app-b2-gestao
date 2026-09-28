// Edge Function: app-email
//
// "Enviar por e-mail": manda um PDF gerado no app (ex.: a Análise com IA da Programação do dia
// ou do Fluxo de caixa) para uma lista de e-mails, pelo Resend (https://resend.com).
// Chamada com o token do usuário logado (verify_jwt = true); só membros do sistema.
//
// O remetente sai no nome de quem está logado: nome e e-mail vêm do token, nunca do corpo.
// O Resend só envia de um domínio verificado, então o "De" é "Nome do usuário <EMAIL_FROM>"
// e as respostas vão para o e-mail do usuário (reply_to).
//
// Assunto e corpo saem do modelo do `tipo` (MODELOS abaixo), montados aqui no servidor: o app
// não manda texto livre, então a função não serve para disparar e-mails com qualquer conteúdo.
// Para liberar o envio em outra tela, acrescente um modelo e chame a função com esse `tipo`.
//
// Segredos (Edge Functions › Secrets):
//   RESEND_API_KEY          chave da API do Resend
//   EMAIL_FROM              endereço do remetente no domínio verificado (ex.: sistemas@empresa.com.br)
//   EMAIL_FROM_NOME_PADRAO  opcional: nome no "De" quando o usuário não tem nome cadastrado
// Sem RESEND_API_KEY ou EMAIL_FROM a função responde 503.
//
// Entrada: { tipo, periodo, para: string[], arquivo: "x.pdf", pdf: base64 }
// Saída:   { ok: true, id }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM = (Deno.env.get("EMAIL_FROM") || "").trim();
const NOME_PADRAO = Deno.env.get("EMAIL_FROM_NOME_PADRAO") || "Departamento de Sistemas";

const MAX_DESTINATARIOS = 10;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// ---------- modelos de e-mail (edite aqui o texto) ----------

type Modelo = { titulo: string; assunto: (periodo: string) => string; paragrafos: (periodo: string) => string[] };

const ASSINATURA = ["Att.,", "Departamento de Sistemas"];
const analise = (titulo: string): Modelo => ({
  titulo,
  assunto: (p) => `${titulo} · ${p}`,
  paragrafos: (p) => [
    "Olá,",
    `Segue a análise do período ${p}.`,
    "Análise gerada a partir de inteligência artificial.",
  ],
});

const MODELOS: Record<string, Modelo> = {
  "analise-prog": analise("Análise com IA · Programação do dia"),
  "analise-fluxo": analise("Análise com IA · Fluxo de caixa"),
};

// ---------- utilitários ----------

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function montarHtml(paragrafos: string[], periodo: string) {
  const p = (t: string) => `<p style="margin:0 0 14px">${t}</p>`;
  const [ola, segue, ia] = paragrafos.map(esc);
  const periodoEsc = esc(periodo);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827">
${p(ola)}
${p(segue.replace(periodoEsc, `<b>${periodoEsc}</b>`))}
<p style="margin:0 0 18px;color:#64748B;font-style:italic">${ia}</p>
<p style="margin:0">${ASSINATURA.map(esc).join("<br>")}</p>
</div>`;
}

/** Tamanho em bytes de um base64 (sem decodificar tudo). */
const bytesBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const cliente = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const [{ data: membro, error: mErr }, { data: quem }] = await Promise.all([
      cliente.rpc("app_is_member"),
      cliente.auth.getUser(auth.replace(/^Bearer\s+/i, "")),
    ]);
    if (!quem?.user) return json({ error: "Sessão inválida." }, 401);
    if (mErr || membro !== true) return json({ error: "Acesso não liberado." }, 403);

    if (!RESEND_API_KEY || !EMAIL_FROM) return json({ error: "Envio de e-mail não configurado (defina RESEND_API_KEY e EMAIL_FROM)." }, 503);

    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const modelo = MODELOS[String(b.tipo || "")];
    if (!modelo) return json({ error: "Tipo de envio inválido." }, 400);

    const periodo = String(b.periodo || "").replace(/[\r\n<>]/g, " ").trim().slice(0, 60);
    if (!periodo) return json({ error: "Período não informado." }, 400);

    const para = [...new Set((Array.isArray(b.para) ? b.para : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
    if (!para.length) return json({ error: "Informe ao menos um e-mail." }, 400);
    if (para.length > MAX_DESTINATARIOS) return json({ error: `No máximo ${MAX_DESTINATARIOS} destinatários por envio.` }, 400);
    const invalidos = para.filter((e) => !EMAIL_RE.test(e));
    if (invalidos.length) return json({ error: `E-mail inválido: ${invalidos.join(", ")}` }, 400);

    const pdf = String(b.pdf || "").replace(/\s+/g, "");
    if (!pdf) return json({ error: "PDF não informado." }, 400);
    if (bytesBase64(pdf) > MAX_PDF_BYTES) return json({ error: "PDF grande demais para enviar por e-mail." }, 413);
    if (!pdf.startsWith("JVBERi")) return json({ error: "O anexo não é um PDF." }, 400); // "%PDF" em base64
    const arquivo = (String(b.arquivo || "analise.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 120) || "analise.pdf").replace(/(\.pdf)?$/i, ".pdf");

    const meta = (quem.user.user_metadata || {}) as Record<string, unknown>;
    const nome = String(meta.full_name || meta.name || NOME_PADRAO).replace(/["<>\r\n]/g, "").trim() || NOME_PADRAO;
    const emailUsuario = (quem.user.email || "").trim().toLowerCase();

    const paragrafos = modelo.paragrafos(periodo);
    const envio: Record<string, unknown> = {
      from: `${nome} <${EMAIL_FROM}>`,
      to: para,
      subject: modelo.assunto(periodo),
      html: montarHtml(paragrafos, periodo),
      text: [...paragrafos, ASSINATURA.join("\n")].join("\n\n"),
      attachments: [{ filename: arquivo, content: pdf }],
    };
    if (emailUsuario) envio.reply_to = emailUsuario;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(envio),
      signal: AbortSignal.timeout(30000),
    });
    const resp = await r.json().catch(() => ({})) as Record<string, unknown>;
    if (!r.ok) {
      console.error("app-email: Resend respondeu", r.status, JSON.stringify(resp).slice(0, 500));
      return json({ error: `O serviço de e-mail recusou o envio (${r.status})${resp.message ? `: ${resp.message}` : "."}` }, 502);
    }
    console.log(JSON.stringify({ app_email: "enviado", tipo: b.tipo, qtd_destinatarios: para.length, usuario: emailUsuario, id: resp.id }));
    return json({ ok: true, id: resp.id ?? null });
  } catch (e) {
    console.error("app-email:", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
