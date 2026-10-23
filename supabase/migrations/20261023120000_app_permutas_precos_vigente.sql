-- Permutas › Importar do contrato: o valor da unidade é o da tabela de vendas vigente na data do contrato
-- (a mais recente até o mês do contrato). Sem tabela até esse mês, a unidade fica sem valor (antes caía na
-- primeira tabela posterior).

create or replace function public.app_permutas_precos(p_enterprise integer[], p_unidade text[], p_data date)
returns table (enterprise_id integer, unidade text, preco numeric, mes_tabela date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', coalesce(p_data, current_date))::date;
begin
  perform app_require_auth();
  if not app_permutas_pode() then
    raise exception 'Sem permissão para Permutas › Cadastro.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_enterprise, 1), 0) <> coalesce(array_length(p_unidade, 1), 0) then
    raise exception 'Listas de empreendimentos e unidades com tamanhos diferentes.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_enterprise, 1), 0) > 200 then
    raise exception 'No máximo 200 unidades por consulta.' using errcode = '22023';
  end if;
  return query
  select pedido.e, pedido.u, preco_tabela.preco, preco_tabela.mes_tabela
  from unnest(p_enterprise, p_unidade) as pedido(e, u)
  cross join lateral (
    select tv.preco, tv.mes_tabela
    from tabela_vendas_unidades tv
    where tv.codigo_empreendimento = pedido.e
      and btrim(tv.unidade) = btrim(pedido.u)
      and tv.preco is not null
      and tv.mes_tabela <= v_mes
    order by tv.mes_tabela desc
    limit 1
  ) preco_tabela;
end;
$$;
revoke all on function public.app_permutas_precos(integer[], text[], date) from public, anon;
grant execute on function public.app_permutas_precos(integer[], text[], date) to authenticated;
