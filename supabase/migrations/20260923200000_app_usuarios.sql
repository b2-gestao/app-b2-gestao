-- Usuários do sistema B2 Gestão e Operações, integrados ao Supabase Auth.
--
-- Fluxo:
--   * A tela Configurações › Usuários chama a edge function "app-usuarios"
--     (supabase/functions/app-usuarios). Com a service_role, ela convida o e-mail no
--     Auth (o convite é o link de definição de senha) e grava o perfil aqui.
--   * O acesso aos dados vem desta tabela: só entra quem tem linha aqui e não está
--     inativo. Um cadastro aberto no Auth (signup) não cria linha e não vê nada.
--   * Quem tem funcao = 'Administrador' pode gerenciar usuários.
--   * Ao entrar pela primeira vez, o status muda de 'pendente' para 'ativo' (trigger).
--
-- Primeiro administrador (uma vez, depois de convidá-lo pelo painel do Supabase em
-- Authentication › Users › Invite user):
--   insert into public.app_usuarios (id, nome, email, funcao, departamento, status)
--   select id, 'Nome Completo', email, 'Administrador', 'Financeiro', 'pendente'
--     from auth.users where email = 'pessoa@empresa.com.br';

create table if not exists public.app_usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  funcao text not null default 'Analista Financeiro',
  departamento text,
  empresas integer[] not null default '{}',
  centros_custo integer[] not null default '{}',
  status text not null default 'pendente' check (status in ('ativo', 'inativo', 'pendente')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null
);

alter table public.app_usuarios enable row level security;

-- Membro ativo/pendente do sistema? (SECURITY DEFINER para não depender da RLS.)
create or replace function public.app_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from app_usuarios where id = auth.uid() and status <> 'inativo');
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from app_usuarios where id = auth.uid() and status <> 'inativo' and funcao = 'Administrador');
$$;

revoke all on function public.app_is_member() from public, anon;
revoke all on function public.app_is_admin() from public, anon;
grant execute on function public.app_is_member() to authenticated;
grant execute on function public.app_is_admin() to authenticated;

-- Leitura para membros; escrita só pela edge function (service_role).
drop policy if exists app_usuarios_select on public.app_usuarios;
create policy app_usuarios_select on public.app_usuarios
  for select to authenticated
  using (public.app_is_member());

revoke all on table public.app_usuarios from anon, authenticated;
grant select on table public.app_usuarios to authenticated;

-- Primeiro login: pendente → ativo.
create or replace function public.app_usuarios_on_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update app_usuarios set status = 'ativo', atualizado_em = now()
     where id = new.id and status = 'pendente';
  end if;
  return new;
end;
$$;

drop trigger if exists app_usuarios_on_sign_in on auth.users;
create trigger app_usuarios_on_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.app_usuarios_on_sign_in();

-- As RPCs financeiras passam a exigir cadastro ativo nesta tabela (substitui a flag
-- app_metadata.b2_acesso da migration anterior).
create or replace function public.app_require_auth()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not app_is_member() then
    raise exception 'acesso nao liberado para este usuario' using errcode = '42501';
  end if;
end;
$$;
