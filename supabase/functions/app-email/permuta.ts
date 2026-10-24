// app-email › tipo "permuta": e-mail com os dados de um permutante (Permutas › Terrenos › Cadastros).
//
// O app manda só o id da permuta. Tudo é lido aqui com o token de quem envia, então valem o RLS e a
// permissão do perfil: só quem pode EDITAR Permutas (app_permutas_pode(true)) envia, e só o que consegue ler.
// Nomes de empreendimento vêm do de-para (de_para_sharepoint), lido com a service_role depois dessa checagem.
// O contrato (último anexo do tipo Contrato) vai anexado quando pedido e cabe no limite do e-mail.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

export class ErroEnvio extends Error {
  constructor(msg: string, readonly status: number) { super(msg); }
}

export interface EmailMontado {
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: string }[];
}

const BUCKET = "app-permutas";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const linha = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const num = (v: unknown): number | null => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));
const f2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m2 = (v: number | null) => (v == null ? "—" : `${f2.format(v)} m²`);
const brl = (v: number | null) => (v == null ? "—" : `R$ ${f2.format(v)}`);
const dataBr = (iso: unknown) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const tamanho = (b: number) => (b >= 1048576 ? `${f2.format(b / 1048576)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** CPF mascarado (dado pessoal); CNPJ por extenso. */
function documento(d: unknown): string | null {
  const s = String(d ?? "").replace(/\D/g, "");
  if (s.length === 11) return `***.${s.slice(3, 6)}.${s.slice(6, 9)}-**`;
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return null;
}

/** Mesmas regras da tela (lib/permutas.ts › calcular). */
function calcular(p: Record<string, unknown>) {
  const mat = num(p.area_matricula), coef = num(p.coeficiente), pct = num(p.pct_permuta);
  const aprov = mat != null && coef != null ? mat * coef : null;
  const area = aprov != null && pct != null ? aprov * pct : num(p.area_informada);
  const proprio = num(p.area_propria) ?? 0;
  let div = area == null ? null : area - proprio;
  if (div != null && Math.abs(div) < 0.01) div = 0;
  return { area, proprio, div };
}

type Item = [rotulo: string, valor: string | null, destaque?: boolean];

export async function montarEmailPermuta(opts: {
  cliente: SupabaseClient;
  admin: SupabaseClient | null;
  permutaId: unknown;
  novo: boolean;
  anexar: boolean;
  autor: string;
  maxAnexoBytes: number;
}): Promise<EmailMontado> {
  const { cliente, admin } = opts;
  const id = String(opts.permutaId || "");
  if (!UUID_RE.test(id)) throw new ErroEnvio("Permuta inválida.", 400);

  const { data: pode, error: pErr } = await cliente.rpc("app_permutas_pode", { p_editar: true });
  if (pErr || pode !== true) throw new ErroEnvio("Seu perfil só pode visualizar Permutas: o envio por e-mail exige permissão de edição.", 403);

  const { data: p, error } = await cliente.from("app_permutas")
    .select("id, empresa_id, negocio_id, permutante, cpf_cnpj, num_matricula, area_matricula, coeficiente, pct_permuta, area_propria, area_informada, "
      + "observacao, pendencia, data_contrato, cidade, inscricao_iptu, inscricao_equatorial, inscricao_saneago, "
      + "unidades:app_permuta_unidades(enterprise_id, unidade_nome, area_privativa, valor_unidade, ordem, ativo), "
      + "anexos:app_permuta_anexos(tipo, descricao, nome, tamanho, storage_path, adicionado_em)")
    .eq("id", id).maybeSingle();
  if (error) throw new ErroEnvio(`Não foi possível ler a permuta: ${error.message}`, 500);
  if (!p) throw new ErroEnvio("Permuta não encontrada.", 404);
  const r = p as Record<string, any>;

  // Origem: empresa do Sienge ou negócio de permuta.
  let origem = "—";
  if (r.empresa_id != null) {
    const { data: emps } = await cliente.rpc("app_empresas");
    const e = (Array.isArray(emps) ? emps : []).find((x: any) => x.id === r.empresa_id);
    origem = `${linha(e?.nome_fantasia || e?.nome) || `Empresa ${r.empresa_id}`} · Sienge ${r.empresa_id}`;
  } else if (r.negocio_id) {
    const { data: n } = await cliente.from("negocios_permuta").select("nome").eq("id", r.negocio_id).maybeSingle();
    origem = linha(n?.nome) || "Negócio";
  }

  const unidades = ((r.unidades || []) as any[]).filter((u) => u.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const nomesEmp = new Map<number, string>();
  const ids = [...new Set(unidades.map((u) => Number(u.enterprise_id)))];
  if (admin && ids.length) {
    const { data: dp } = await admin.from("de_para_sharepoint").select("cd_empreendimento_centro_de_custo, nome")
      .in("cd_empreendimento_centro_de_custo", ids.map(String)).order("id");
    for (const d of (dp || []) as any[]) {
      const k = Number(d.cd_empreendimento_centro_de_custo);
      if (!nomesEmp.has(k) && linha(d.nome)) nomesEmp.set(k, linha(d.nome));
    }
  }
  const nomeEmp = (eid: number) => nomesEmp.get(Number(eid)) || `Empreendimento ${eid}`;
  const principal = unidades.length ? nomeEmp(unidades[0].enterprise_id) : null;

  // Contrato: o anexo do tipo Contrato mais recente.
  const anexos = ((r.anexos || []) as any[]).sort((a, b) => String(a.adicionado_em).localeCompare(String(b.adicionado_em)));
  const contrato = [...anexos].reverse().find((a) => a.tipo === "Contrato") || null;
  const attachments: EmailMontado["attachments"] = [];
  let avisoAnexo: string | null = null;
  if (opts.anexar && contrato) {
    if (Number(contrato.tamanho) > opts.maxAnexoBytes) {
      avisoAnexo = `O contrato (${tamanho(Number(contrato.tamanho))}) passa do limite do e-mail e não foi anexado; ele está disponível nos documentos do cadastro no B2.`;
    } else {
      const { data: blob, error: dErr } = await cliente.storage.from(BUCKET).download(contrato.storage_path);
      if (dErr || !blob) throw new ErroEnvio("Não foi possível ler o contrato para anexar.", 500);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length > opts.maxAnexoBytes) {
        avisoAnexo = "O contrato passa do limite do e-mail e não foi anexado; ele está disponível nos documentos do cadastro no B2.";
      } else {
        const filename = String(contrato.nome || "contrato.pdf").normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^\w.\-]+/g, "_").slice(-120) || "contrato.pdf";
        attachments.push({ filename, content: encodeBase64(bytes) });
      }
    }
  }

  const permutante = linha(r.permutante);
  const c = calcular(r);
  const pct = num(r.pct_permuta);
  const coef = num(r.coeficiente);
  const titulo = opts.novo ? "Permuta cadastrada" : "Dados da permuta";
  const subject = [titulo, permutante, principal].filter(Boolean).join(" · ").slice(0, 200);
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).replace(", ", " às ");

  const secoes: { titulo: string; itens?: Item[]; html?: string; texto?: string }[] = [
    {
      titulo: "Permutante",
      itens: [["Nome", permutante, true], ["CPF/CNPJ", documento(r.cpf_cnpj)], ["Negócio / empresa", origem], ["Cidade", linha(r.cidade) || null]],
    },
    {
      titulo: "Terreno e contrato",
      itens: [
        ["Nº da matrícula", linha(r.num_matricula) || null],
        ["Data do contrato", r.data_contrato ? dataBr(r.data_contrato) : null],
        ["Área da matrícula", num(r.area_matricula) == null ? null : m2(num(r.area_matricula))],
        ["Coeficiente", coef == null ? null : f2.format(coef)],
        ["% de permuta", pct == null ? null : `${f2.format(pct * 100)}%`],
        ["Área de permuta", m2(c.area), true],
        ["No próprio empreendimento", m2(c.proprio)],
        ["Em empreendimentos diversos", m2(c.div)],
      ],
    },
  ];

  // Unidades: tabela com total.
  if (unidades.length) {
    const totM2 = unidades.reduce((s, u) => s + (num(u.area_privativa) ?? 0), 0);
    const comValor = unidades.filter((u) => num(u.valor_unidade) != null);
    const totValor = comValor.reduce((s, u) => s + (num(u.valor_unidade) ?? 0), 0);
    const td = (t: string, dir = false, extra = "") => `<td style="padding:8px 10px;${dir ? "text-align:right;" : ""}${extra}">${t}</td>`;
    const linhas = unidades.map((u) => `<tr style="border-bottom:1px solid #EEEEF1">${td(esc(nomeEmp(u.enterprise_id)))}${td(esc(linha(u.unidade_nome)))}${td(esc(num(u.area_privativa) == null ? "—" : f2.format(num(u.area_privativa)!)), true)}${td(esc(brl(num(u.valor_unidade))), true)}</tr>`).join("");
    secoes.push({
      titulo: "Unidades em troca",
      html: `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
<tr style="background:#F7F8FA;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#4B5563">${td("Empreendimento")}${td("Unidade")}${td("m²", true)}${td("Valor", true)}</tr>
${linhas}
<tr style="font-weight:700;background:#F7F8FA"><td style="padding:8px 10px" colspan="2">Total · ${unidades.length} ${unidades.length === 1 ? "unidade" : "unidades"}</td>${td(esc(f2.format(totM2)), true)}${td(esc(comValor.length ? brl(totValor) : "—"), true)}</tr>
</table>`,
      texto: [...unidades.map((u) => `- ${nomeEmp(u.enterprise_id)} · ${linha(u.unidade_nome)} · ${num(u.area_privativa) == null ? "—" : f2.format(num(u.area_privativa)!)} m² · ${brl(num(u.valor_unidade))}`),
        `Total: ${unidades.length} ${unidades.length === 1 ? "unidade" : "unidades"} · ${f2.format(totM2)} m² · ${comValor.length ? brl(totValor) : "—"}`].join("\n"),
    });
  }

  const inscricoes: Item[] = [["IPTU", linha(r.inscricao_iptu) || null], ["Equatorial", linha(r.inscricao_equatorial) || null], ["Saneago", linha(r.inscricao_saneago) || null]];
  if (inscricoes.some((i) => i[1])) secoes.push({ titulo: "Inscrições", itens: inscricoes });

  const obs = String(r.observacao ?? "").trim(), pend = String(r.pendencia ?? "").trim();
  if (obs || pend) {
    const par = (rot: string, t: string) => `<p style="margin:8px 0 0;font-size:13px;white-space:pre-line"><b>${rot}:</b> ${esc(t)}</p>`;
    secoes.push({
      titulo: "Observação e pendência",
      html: (obs ? par("Observação", obs) : "") + (pend ? par("Pendência", pend) : ""),
      texto: [obs ? `Observação: ${obs}` : "", pend ? `Pendência: ${pend}` : ""].filter(Boolean).join("\n"),
    });
  }

  if (anexos.length) {
    const nomeDoc = (a: any) => `${a.tipo === "Outro" ? linha(a.descricao) || "Outro" : a.tipo} · ${linha(a.nome)}`;
    const anexado = (a: any) => attachments.length && a === contrato;
    secoes.push({
      titulo: "Documentos",
      html: `<ul style="margin:8px 0 0;padding-left:18px;font-size:13px">${anexos.map((a) => `<li>${esc(nomeDoc(a))}${anexado(a) ? ' <span style="color:#4B5563">(anexo a este e-mail)</span>' : ""}</li>`).join("")}</ul>`
        + (avisoAnexo ? `<p style="margin:8px 0 0;font-size:12px;color:#92590A">${esc(avisoAnexo)}</p>` : ""),
      texto: anexos.map((a) => `- ${nomeDoc(a)}${anexado(a) ? " (anexo)" : ""}`).join("\n") + (avisoAnexo ? `\n${avisoAnexo}` : ""),
    });
  }

  // ---------- HTML e texto ----------
  const tabela = (itens: Item[]) => `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:4px">${itens.filter((i) => i[1])
    .map(([rot, val, dest]) => `<tr><td style="padding:6px 0;color:#4B5563;width:44%">${esc(rot)}</td><td style="padding:6px 0;${dest ? "font-weight:700" : ""}">${esc(val!)}</td></tr>`).join("")}</table>`;
  const cab = (n: number, t: string) => `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#2445E8;font-weight:700;padding-bottom:6px;border-bottom:2px solid #ECEFFF">${n}. ${esc(t)}</div>`;
  const intro = opts.novo ? "Um novo permutante foi cadastrado no B2. Os dados estão abaixo." : "Seguem os dados atuais desta permuta no B2.";

  const html = `<div style="background:#F2F3F6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827">
<div style="max-width:620px;margin:0 auto;background:#FFFFFF;border-radius:10px;border:1px solid #E7E7EA;overflow:hidden">
<div style="padding:22px 28px;border-bottom:1px solid #EEEEF1">
<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;font-weight:700">B2 Gestão · Permutas › Terrenos</div>
<div style="font-size:20px;font-weight:700;margin-top:6px">${esc(titulo)}</div>
<div style="font-size:12.5px;color:#4B5563;margin-top:4px">Por ${esc(opts.autor)} em ${esc(quando)}</div>
</div>
<div style="padding:22px 28px">
<p style="margin:0 0 22px">Olá,<br>${esc(intro)}</p>
${secoes.map((s, i) => `<div style="margin:0 0 22px">${cab(i + 1, s.titulo)}${s.itens ? tabela(s.itens) : s.html || ""}</div>`).join("\n")}
</div>
<div style="padding:16px 28px;background:#F7F8FA;border-top:1px solid #EEEEF1;font-size:12px;color:#4B5563">Att.,<br>Departamento de Sistemas<br><span style="font-size:11px">E-mail enviado pelo B2 Gestão. As respostas vão para quem enviou.</span></div>
</div>
</div>`;

  const text = [
    `${titulo} · por ${opts.autor} em ${quando}`,
    `Olá,\n${intro}`,
    ...secoes.map((s, i) => `${i + 1}. ${s.titulo.toUpperCase()}\n${s.itens ? s.itens.filter((x) => x[1]).map(([rot, val]) => `${rot}: ${val}`).join("\n") : s.texto || ""}`),
    "Att.,\nDepartamento de Sistemas",
  ].filter(Boolean).join("\n\n");

  return { subject, html, text, attachments };
}
