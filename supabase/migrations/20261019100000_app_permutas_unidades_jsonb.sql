-- Permutas: o catálogo de unidades passa de 20 mil linhas, e uma função "returns table" chamada pelo
-- PostgREST para nas 1000 primeiras. Devolve tudo numa chamada só, em jsonb (como app_crc_carregar).
-- Formato de cada item: [enterprise_id, empreendimento, company_id, unidade_id, unidade, area_privativa, entrega]
-- (array posicional para o JSON ficar pequeno; o app monta os objetos).

drop function if exists public.app_permutas_unidades();

create or replace function public.app_permutas_unidades()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_require_auth();
  if not app_permutas_pode() then
    raise exception 'Sem permissão para Permutas.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(x.enterprise_id, x.nome, x.cd_empresa, x.id, x.name, x.private_area, x.entrega)
                     order by x.enterprise_id, x.name)
    from (
      select u.enterprise_id, d.nome, d.cd_empresa, u.id, u.name, u.private_area,
             max(u.delivery_date) over (partition by u.enterprise_id) as entrega
      from unidades u
      left join lateral (
        select dp.nome, dp.cd_empresa
        from de_para_sharepoint dp
        where dp.cd_empreendimento_centro_de_custo = u.enterprise_id::text
        order by dp.id
        limit 1
      ) d on true
      where u.enterprise_id is not null and u.name is not null
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.app_permutas_unidades() from public, anon;
grant execute on function public.app_permutas_unidades() to authenticated;
