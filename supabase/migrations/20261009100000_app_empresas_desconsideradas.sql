-- Configurações › Gerais · empresas desconsideradas em todo o app.
--
-- Empresas baixadas (ou fora por regra de negócio) deixam de aparecer no app: nenhum dado delas é
-- usado em saldos, programação, fluxo, painel, lançamentos, NF, CRC ou seletores.
--
-- Onde a regra é aplicada: nas duas funções que já concentram o acesso por empresa
-- (20260930100000_app_acesso_empresas):
--   * app_filtra_empresas → filtro de todas as RPCs de leitura;
--   * app_pode_empresa    → RLS das tabelas do app, CRC, NF e gravações do app-nf.
-- app_todas_empresas_usuario / app_empresas_usuario não mudam: continuam dizendo o que o usuário
-- tem liberado (app-usuarios usa isso para conceder acesso), então as empresas desconsideradas
-- ficam guardadas nos perfis/usuários e voltam quando saem da lista.
-- O conector MCP (mcp-parcelas) não passa por essas funções e não é afetado.
--
-- Acesso: leitura para membros (só das empresas que acessam); escrita para configuracoes.gerais.

create table if not exists public.app_empresas_desconsideradas (
  company_id integer primary key,
  motivo text not null check (length(trim(motivo)) between 1 and 300),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists app_empresas_desconsideradas_auditoria on public.app_empresas_desconsideradas;
create trigger app_empresas_desconsideradas_auditoria
  before insert or update on public.app_empresas_desconsideradas
  for each row execute function public.app_set_auditoria();

-- ---------- funções de acesso ----------
create or replace function public.app_empresas_desconsideradas_ids()
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array(select d.company_id from app_empresas_desconsideradas d order by 1), '{}'::integer[]);
$$;

-- Acesso liberado no perfil/usuário, sem olhar a lista de desconsideradas.
create or replace function public.app_acesso_empresa(p_company integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_todas_empresas_usuario(auth.uid()) or p_company = any(app_empresas_usuario(auth.uid()));
$$;

create or replace function public.app_pode_empresa(p_company integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_acesso_empresa(p_company) and p_company <> all(app_empresas_desconsideradas_ids());
$$;

-- Nulo = todas, só quando o usuário vê todas e nenhuma empresa está desconsiderada.
create or replace function public.app_filtra_empresas(p_empresas integer[])
returns integer[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_excl integer[] := app_empresas_desconsideradas_ids();
  v_emp integer[];
begin
  if app_todas_empresas_usuario(auth.uid()) then
    if p_empresas is null then
      if cardinality(v_excl) = 0 then
        return null;
      end if;
      return array(select e.id from empresas e where e.id <> all(v_excl) order by e.id);
    end if;
    v_emp := p_empresas;
  elsif p_empresas is null then
    v_emp := app_empresas_usuario(auth.uid());
  else
    v_emp := array(select e from unnest(p_empresas) e where e = any(app_empresas_usuario(auth.uid())));
  end if;
  return array(select e from unnest(v_emp) e where e <> all(v_excl));
end;
$$;

-- Só usada dentro das funções security definer acima.
revoke all on function public.app_empresas_desconsideradas_ids() from public, anon, authenticated;
revoke all on function public.app_acesso_empresa(integer) from public, anon;
revoke all on function public.app_pode_empresa(integer) from public, anon;
revoke all on function public.app_filtra_empresas(integer[]) from public, anon;
grant execute on function public.app_acesso_empresa(integer) to authenticated;
grant execute on function public.app_pode_empresa(integer) to authenticated;
grant execute on function public.app_filtra_empresas(integer[]) to authenticated;

-- ---------- RLS ----------
alter table public.app_empresas_desconsideradas enable row level security;

drop policy if exists app_empresas_desconsideradas_select on public.app_empresas_desconsideradas;
create policy app_empresas_desconsideradas_select on public.app_empresas_desconsideradas
  for select to authenticated using (public.app_is_member() and public.app_acesso_empresa(company_id));
drop policy if exists app_empresas_desconsideradas_insert on public.app_empresas_desconsideradas;
create policy app_empresas_desconsideradas_insert on public.app_empresas_desconsideradas
  for insert to authenticated
  with check (public.app_pode('configuracoes.gerais', true) and public.app_acesso_empresa(company_id));
drop policy if exists app_empresas_desconsideradas_update on public.app_empresas_desconsideradas;
create policy app_empresas_desconsideradas_update on public.app_empresas_desconsideradas
  for update to authenticated
  using (public.app_pode('configuracoes.gerais', true) and public.app_acesso_empresa(company_id))
  with check (public.app_pode('configuracoes.gerais', true) and public.app_acesso_empresa(company_id));
drop policy if exists app_empresas_desconsideradas_delete on public.app_empresas_desconsideradas;
create policy app_empresas_desconsideradas_delete on public.app_empresas_desconsideradas
  for delete to authenticated
  using (public.app_pode('configuracoes.gerais', true) and public.app_acesso_empresa(company_id));

revoke all on table public.app_empresas_desconsideradas from anon, authenticated;
grant select, insert, update, delete on table public.app_empresas_desconsideradas to authenticated;

-- ---------- catálogo da tela Gerais ----------
-- Empresas que o usuário acessa, inclusive as desconsideradas (app_empresas não traz essas).
create or replace function public.app_empresas_gerais()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_todas boolean;
  v_emp integer[];
begin
  perform app_require_auth();
  if not app_pode('configuracoes.gerais') then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  v_todas := app_todas_empresas_usuario(auth.uid());
  v_emp := app_empresas_usuario(auth.uid());
  with dp as (
    select (to_jsonb(d) ->> 'cd_empresa')::int as cd_empresa,
           string_agg(distinct nullif(trim(to_jsonb(d) ->> 'nome'), ''), ', ') as empreendimentos
    from de_para_sharepoint d
    where (to_jsonb(d) ->> 'cd_empresa') ~ '^\d+$'
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'nome', e.name,
           'nome_fantasia', nullif(trim(e.trade_name), ''),
           'cnpj', e.cnpj,
           'empreendimentos', dp.empreendimentos
         ) order by e.id), '[]'::jsonb)
    into result
  from empresas e
  left join dp on dp.cd_empresa = e.id
  where v_todas or e.id = any(v_emp);
  return result;
end;
$$;

revoke all on function public.app_empresas_gerais() from public, anon;
grant execute on function public.app_empresas_gerais() to authenticated;

-- ---------- permissão ----------
-- Nova tela na árvore de perfis; o perfil de sistema (Administrador) já passa em app_pode.
update public.app_perfis
set permissoes = permissoes || jsonb_build_object('configuracoes.gerais', jsonb_build_object('view', false, 'edit', false))
where not (permissoes ? 'configuracoes.gerais');
