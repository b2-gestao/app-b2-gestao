-- Restrição por usuário: ignora o que o perfil libera e usa só as empresas do cadastro do usuário.
--
--   usuario.restringir_empresas = true → vê só usuario.empresas (nem perfil.todas_empresas,
--                                        nem perfil.empresas, nem perfil de sistema contam)
--   senão                              → regra de antes (perfil ∪ usuário)
--
-- Serve para quem está num perfil que libera todas as empresas mas deve ver só algumas.

alter table public.app_usuarios add column if not exists restringir_empresas boolean not null default false;

create or replace function public.app_todas_empresas_usuario(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_usuarios u
    join app_perfis p on p.nome = u.funcao
    where u.id = p_user and u.status <> 'inativo' and p.ativo
      and not u.restringir_empresas
      and (p.sistema or p.todas_empresas or u.todas_empresas)
  );
$$;

create or replace function public.app_empresas_usuario(p_user uuid)
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select array(
      select distinct e
      from unnest(case when u.restringir_empresas then u.empresas else p.empresas || u.empresas end) e
      order by e
    )
    from app_usuarios u
    join app_perfis p on p.nome = u.funcao
    where u.id = p_user and u.status <> 'inativo' and p.ativo
  ), '{}'::integer[]);
$$;

revoke all on function public.app_todas_empresas_usuario(uuid) from public, anon, authenticated;
revoke all on function public.app_empresas_usuario(uuid) from public, anon, authenticated;
grant execute on function public.app_todas_empresas_usuario(uuid) to service_role;
grant execute on function public.app_empresas_usuario(uuid) to service_role;
