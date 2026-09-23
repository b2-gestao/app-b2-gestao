// Edge Function: app-usuarios
//
// Gestão de usuários do B2 Gestão e Operações no Supabase Auth. Chamada pela tela
// Configurações › Usuários com o token do usuário logado (verify_jwt = true).
// Só quem tem permissão de edição em Configurações › Usuários (perfil em app_perfis;
// o perfil de sistema "Administrador" tem tudo) pode usar.
//
// Ações (POST { acao, ... }):
//   convidar        { nome, email, telefone?, funcao, departamento?, empresas[], centros_custo[], ativo }
//                   → cria o usuário no Auth e envia o e-mail de convite (link de definição de senha)
//   atualizar       { id, nome, telefone?, funcao, departamento?, empresas[], centros_custo[], ativo }
//   definir_status  { id, ativo }   → inativar bloqueia o login (ban) e o acesso aos dados
//   reenviar_convite{ id }          → novo link de definição de senha (usuário que ainda não entrou)
//   redefinir_senha { id }          → e-mail de redefinição de senha
//   excluir         { id }          → remove do Auth (o perfil sai em cascata)
//
// Segredos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (automáticos) e APP_URL
// (endereço do front-end, para onde o link do e-mail leva).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";

const PERM_USUARIOS = "configuracoes.usuarios";
const BAN_INATIVO = "876000h"; // ~100 anos

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

class Erro extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function ids(v: unknown): number[] {
  return Array.isArray(v) ? [...new Set(v.map(Number).filter(n => Number.isInteger(n) && n > 0))] : [];
}
async function perfil(b: Record<string, unknown>) {
  const nome = texto(b.nome);
  if (!nome) throw new Erro("Informe o nome completo.");
  const funcao = texto(b.funcao);
  const { data: p } = await admin.from("app_perfis").select("nome").eq("nome", funcao).eq("ativo", true).maybeSingle();
  if (!p) throw new Erro("Função inválida: escolha um perfil ativo.");
  const departamento = texto(b.departamento, 80);
  if (departamento) {
    const { data: d } = await admin.from("app_departamentos").select("nome").eq("nome", departamento).maybeSingle();
    if (!d) throw new Erro("Departamento não cadastrado.");
  }
  return {
    nome,
    telefone: texto(b.telefone, 40) || null,
    funcao,
    departamento: departamento || null,
    empresas: ids(b.empresas),
    centros_custo: ids(b.centros_custo),
  };
}

async function carregar(id: string) {
  const { data, error } = await admin.from("app_usuarios").select("*").eq("id", id).maybeSingle();
  if (error) throw new Erro(error.message, 500);
  if (!data) throw new Erro("Usuário não encontrado.", 404);
  return data;
}

async function pode(userId: string, path: string) {
  const { data, error } = await admin.rpc("app_pode_usuario", { p_user: userId, p_path: path, p_editar: true });
  if (error) throw new Erro(error.message, 500);
  return data === true;
}

async function bloquear(id: string, bloqueado: boolean) {
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: bloqueado ? BAN_INATIVO : "none" });
  if (error) throw new Erro(error.message, 500);
}

async function linkSenha(email: string, tipo: "invite" | "recovery") {
  const redirectTo = APP_URL || undefined;
  if (tipo === "invite") {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) throw new Erro(error.message, 400);
  } else {
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Erro(error.message, 400);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    // Quem está chamando?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !quem?.user) throw new Erro("Sessão inválida.", 401);
    if (!(await pode(quem.user.id, PERM_USUARIOS))) {
      throw new Erro("Seu perfil não tem permissão para gerenciar usuários.", 403);
    }

    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const acao = texto(b.acao, 40);
    const id = texto(b.id, 60);

    if (acao === "convidar") {
      const email = texto(b.email, 200).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Erro("Informe um e-mail válido.");
      const dados = await perfil(b);
      const { data: existe } = await admin.from("app_usuarios").select("id").eq("email", email).maybeSingle();
      if (existe) throw new Erro("Já existe um usuário com esse e-mail.");

      const { data: conv, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: dados.nome, role: dados.funcao },
        redirectTo: APP_URL || undefined,
      });
      if (error || !conv?.user) throw new Erro(error?.message || "Não foi possível convidar o usuário.", 400);

      const ativo = b.ativo !== false;
      const { data: linha, error: insErr } = await admin.from("app_usuarios").insert({
        id: conv.user.id, email, ...dados, status: ativo ? "pendente" : "inativo", criado_por: quem.user.id,
      }).select("*").single();
      if (insErr) {
        await admin.auth.admin.deleteUser(conv.user.id); // não deixa usuário órfão no Auth
        throw new Erro(insErr.message, 500);
      }
      if (!ativo) await bloquear(conv.user.id, true);
      return json({ usuario: linha });
    }

    if (!id) throw new Erro("Informe o id do usuário.");
    const atual = await carregar(id);

    if (acao === "atualizar") {
      const dados = await perfil(b);
      const novoEmail = texto(b.email, 200).toLowerCase();
      if (novoEmail && novoEmail !== atual.email) throw new Erro("O e-mail não pode ser alterado. Exclua o usuário e convide o novo e-mail.");
      if (id === quem.user.id && dados.funcao !== atual.funcao) {
        const { data: novo } = await admin.from("app_perfis").select("sistema, permissoes").eq("nome", dados.funcao).single();
        if (!novo?.sistema && novo?.permissoes?.[PERM_USUARIOS]?.edit !== true) {
          throw new Erro("Você não pode trocar sua própria função por uma sem permissão de gerenciar usuários.");
        }
      }
      const ativo = b.ativo !== false;
      if (id === quem.user.id && !ativo) throw new Erro("Você não pode inativar a si mesmo.");
      const status = ativo ? (atual.status === "inativo" ? "ativo" : atual.status) : "inativo";
      const { data: linha, error } = await admin.from("app_usuarios")
        .update({ ...dados, status, atualizado_em: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw new Erro(error.message, 500);
      await admin.auth.admin.updateUserById(id, { user_metadata: { full_name: dados.nome, role: dados.funcao } });
      if (status === "inativo" || atual.status === "inativo") await bloquear(id, status === "inativo");
      return json({ usuario: linha });
    }

    if (acao === "definir_status") {
      const ativo = b.ativo === true;
      if (id === quem.user.id && !ativo) throw new Erro("Você não pode inativar a si mesmo.");
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      const status = ativo ? (authUser?.user?.last_sign_in_at ? "ativo" : "pendente") : "inativo";
      await bloquear(id, !ativo);
      const { data: linha, error } = await admin.from("app_usuarios")
        .update({ status, atualizado_em: new Date().toISOString() }).eq("id", id).select("*").single();
      if (error) throw new Erro(error.message, 500);
      return json({ usuario: linha });
    }

    if (acao === "reenviar_convite" || acao === "redefinir_senha") {
      if (atual.status === "inativo") throw new Erro("Usuário inativo. Reative antes de enviar o link.");
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      const nuncaEntrou = !authUser?.user?.last_sign_in_at;
      // Convite só vale para quem ainda não confirmou; depois disso, recuperação de senha.
      await linkSenha(atual.email, acao === "reenviar_convite" && nuncaEntrou && !authUser?.user?.email_confirmed_at ? "invite" : "recovery");
      return json({ ok: true });
    }

    if (acao === "excluir") {
      if (id === quem.user.id) throw new Erro("Você não pode excluir a si mesmo.");
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Erro(error.message, 500);
      return json({ ok: true });
    }

    throw new Erro("Ação desconhecida.");
  } catch (e) {
    const err = e instanceof Erro ? e : new Erro(String((e as Error)?.message || e), 500);
    return json({ error: err.message }, err.status);
  }
});
