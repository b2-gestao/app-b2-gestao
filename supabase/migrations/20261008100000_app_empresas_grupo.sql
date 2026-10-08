-- Filtro por grupo de empresa (Programação diária / Fluxo de caixa).
--
-- O grupo vem de grupo_empresas_sharepoint ("cd empresa" = empresas.id, "grupo" = nome do grupo),
-- carregada pelo n8n. A tabela continua fechada para anon/authenticated: o app recebe o grupo
-- pela RPC app_empresas, que já aplica o acesso por empresa (app_filtra_empresas).
-- Mesma definição de 20260930100000_app_acesso_empresas, só com o campo "grupo".

create or replace function public.app_empresas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
  with dp as (
    select (to_jsonb(d) ->> 'cd_empresa')::int as cd_empresa,
           string_agg(distinct nullif(trim(to_jsonb(d) ->> 'nome'), ''), ', ') as empreendimentos
    from de_para_sharepoint d
    where (to_jsonb(d) ->> 'cd_empresa') ~ '^\d+$'
    group by 1
  ),
  gr as (
    select g."cd empresa" as cd_empresa,
           min(nullif(trim(g.grupo), '')) as grupo
    from grupo_empresas_sharepoint g
    where g."cd empresa" is not null
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'nome', e.name,
           'nome_fantasia', nullif(trim(e.trade_name), ''),
           'cnpj', e.cnpj,
           'empreendimentos', dp.empreendimentos,
           'grupo', gr.grupo
         ) order by e.id), '[]'::jsonb)
    into result
  from empresas e
  left join dp on dp.cd_empresa = e.id
  left join gr on gr.cd_empresa = e.id
  where (v_emp is null or e.id = any(v_emp));
  return result;
end;
$$;

revoke all on function public.app_empresas() from public, anon;
grant execute on function public.app_empresas() to authenticated;
