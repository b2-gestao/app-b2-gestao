-- Permutas › Terrenos › Cadastros: importação do contrato por IA (edge function app-permutas).
--
--   app_permutas.cpf_cnpj      CPF ou CNPJ do permutante principal, só dígitos (11 ou 14). O histórico
--                              (app_permutas_historico) registra as mudanças pela trigger que já existe.
--   app_permutas_precos(...)   Preço de cada unidade na tabela de vendas (tabela_vendas_unidades) do mês do
--                              contrato: a tabela mais recente até esse mês; sem ela, a mais antiga depois dele.
--                              A tela grava o valor na unidade e só muda se o usuário editar.
--
-- Depende de 20261022100000_app_permutas_inativacao_historico.sql (aplicar antes).

alter table public.app_permutas add column if not exists cpf_cnpj text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_permutas_cpf_cnpj_ck') then
    alter table public.app_permutas
      add constraint app_permutas_cpf_cnpj_ck check (cpf_cnpj is null or cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$');
  end if;
end;
$$;

-- tabela_vendas_unidades não tem grant para o app; a leitura passa por esta função, que confere a permissão.
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
    -- Primeiro a tabela mais recente até o mês do contrato; sem ela, a mais antiga depois.
    order by (tv.mes_tabela <= v_mes) desc,
             case when tv.mes_tabela <= v_mes then tv.mes_tabela end desc nulls last,
             tv.mes_tabela asc
    limit 1
  ) preco_tabela;
end;
$$;
revoke all on function public.app_permutas_precos(integer[], text[], date) from public, anon;
grant execute on function public.app_permutas_precos(integer[], text[], date) to authenticated;
