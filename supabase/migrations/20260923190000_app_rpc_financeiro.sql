-- B2 Gestão e Operações · RPCs de leitura usadas pelo front-end (app/).
--
-- Por que funções e não acesso direto às tabelas:
--   * parcelas_pagar_raw e parcelas_receber são trocadas por RENAME a cada sync
--     (swap_parcelas_pagar_raw / swap_parcelas_receber). RLS, policies, grants e
--     índices aplicados nelas se perdem no próximo sync.
--   * empresas e centros_custo já têm RLS ligado sem policy, então o papel
--     "authenticated" não enxerga nada.
--   * O PostgREST limita respostas de RPC em conjunto a 1000 linhas; aqui tudo
--     volta como um único jsonb.
--
-- Todas as funções são SECURITY DEFINER, exigem usuário logado (Supabase Auth) e
-- só podem ser executadas pelo papel "authenticated". A migration
-- 20260923200000_app_usuarios.sql endurece app_require_auth(): só passa quem tem
-- cadastro ativo em app_usuarios.
-- São plpgsql (não BEGIN ATOMIC) para resolver o nome das tabelas em tempo de
-- execução e continuar funcionando depois do swap.

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
end;
$$;

-- Empresas + nome do empreendimento vindo do De Para (LEFT JOIN: nem toda empresa
-- está no De Para). Uma empresa pode ter vários empreendimentos no De Para, então
-- os nomes são agregados para não duplicar a empresa.
-- A planilha De Para muda de colunas mês a mês; to_jsonb(d) ->> 'coluna' evita que
-- a função quebre se "cd_empresa" ou "nome" sumirem numa carga.
create or replace function public.app_empresas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
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
  left join dp on dp.cd_empresa = e.id;
  return result;
end;
$$;

create or replace function public.app_centros_custo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.name, 'id_empresa', c.id_company) order by c.id), '[]'::jsonb)
    into result
  from centros_custo c;
  return result;
end;
$$;

create or replace function public.app_contas_correntes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', c.company_id,
           'company_name', c.company_name,
           'bank_number', c.bank_number,
           'bank_name', c.bank_name,
           'agency_number', c.agency_number,
           'account_number', c.account_number,
           'account_name', c.account_name,
           'account_type', c.account_type_description
         ) order by c.company_id, c.bank_name, c.account_number), '[]'::jsonb)
    into result
  from contas_correntes c
  where c.account_status = 'ENABLED';
  return result;
end;
$$;

-- Títulos a pagar em aberto (balance_amount > 0) com vencimento no período.
-- Usado pela Programação do dia. p_empresas nulo = todas.
create or replace function public.app_pagar_periodo(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'bill_id', p.bill_id,
           'installment_id', p.installment_id,
           'company_id', p.company_id,
           'company_name', p.company_name,
           'due_date', p.due_date,
           'creditor_name', p.creditor_name,
           'document_id', trim(p.document_identification_id),
           'document_number', p.document_number,
           'business_area', p.business_area_name,
           'balance', p.balance_amount,
           'authorized', p.authorization_status = 'S'
         ) order by p.company_id, p.due_date, p.balance_amount desc), '[]'::jsonb)
    into result
  from parcelas_pagar_raw p
  where p.balance_amount > 0
    and p.due_date between p_de and p_ate
    and (p_empresas is null or p.company_id = any(p_empresas));
  return result;
end;
$$;

-- Totais diários por empresa de parcelas a receber e a pagar.
--   *_aberto   = saldo em aberto (balance_amount > 0) → Fluxo de caixa (projeção)
--   *_original = valor original das parcelas do dia → série "entradas vs saídas"
--   pagar_desconto / pagar_correcao → card de custo financeiro do painel
create or replace function public.app_fluxo_diario(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;
  with rec as (
    select r.company_id, r.due_date as dia,
           sum(r.balance_amount) filter (where r.balance_amount > 0) as receber_aberto,
           sum(r.original_amount) as receber_original
    from parcelas_receber r
    where r.due_date between p_de and p_ate
      and (p_empresas is null or r.company_id = any(p_empresas))
    group by 1, 2
  ),
  pag as (
    select p.company_id, p.due_date as dia,
           sum(p.balance_amount) filter (where p.balance_amount > 0) as pagar_aberto,
           sum(p.original_amount) as pagar_original,
           sum(p.original_amount - coalesce(p.balance_amount, 0)) as pagar_quitado,
           sum(coalesce(p.discount_amount, 0)) as pagar_desconto,
           sum(greatest(coalesce(p.corrected_balance_amount, 0) - coalesce(p.balance_amount, 0), 0)) as pagar_correcao
    from parcelas_pagar_raw p
    where p.due_date between p_de and p_ate
      and (p_empresas is null or p.company_id = any(p_empresas))
    group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', coalesce(rec.company_id, pag.company_id),
           'dia', coalesce(rec.dia, pag.dia),
           'receber_aberto', coalesce(rec.receber_aberto, 0),
           'receber_original', coalesce(rec.receber_original, 0),
           'pagar_aberto', coalesce(pag.pagar_aberto, 0),
           'pagar_original', coalesce(pag.pagar_original, 0),
           'pagar_quitado', coalesce(pag.pagar_quitado, 0),
           'pagar_desconto', coalesce(pag.pagar_desconto, 0),
           'pagar_correcao', coalesce(pag.pagar_correcao, 0)
         )), '[]'::jsonb)
    into result
  from rec
  full join pag on pag.company_id = rec.company_id and pag.dia = rec.dia;
  return result;
end;
$$;

-- Valor original a pagar por empresa e segmento (business_area_name) no período.
-- Alimenta "Ranking por empresa" e "Diluição por segmento" no painel.
create or replace function public.app_pagar_segmentos(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  if p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'periodo invalido';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', t.company_id,
           'segmento', t.segmento,
           'total', t.total
         )), '[]'::jsonb)
    into result
  from (
    select p.company_id, coalesce(nullif(trim(p.business_area_name), ''), 'Sem segmento') as segmento,
           sum(p.original_amount) as total
    from parcelas_pagar_raw p
    where p.due_date between p_de and p_ate
    group by 1, 2
  ) t;
  return result;
end;
$$;

-- Horário do último sync bem-sucedido com o Sienge (pílula "Sienge sincronizado às…").
create or replace function public.app_ultimo_sync()
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result timestamptz;
begin
  perform app_require_auth();
  select max(finished_at) into result from sync_log where status = 'success';
  return result;
end;
$$;

revoke all on function public.app_ultimo_sync() from public, anon;
grant execute on function public.app_ultimo_sync() to authenticated;

revoke all on function public.app_require_auth() from public, anon;
revoke all on function public.app_empresas() from public, anon;
revoke all on function public.app_centros_custo() from public, anon;
revoke all on function public.app_contas_correntes() from public, anon;
revoke all on function public.app_pagar_periodo(date, date, int[]) from public, anon;
revoke all on function public.app_fluxo_diario(date, date, int[]) from public, anon;
revoke all on function public.app_pagar_segmentos(date, date) from public, anon;

grant execute on function public.app_require_auth() to authenticated;
grant execute on function public.app_empresas() to authenticated;
grant execute on function public.app_centros_custo() to authenticated;
grant execute on function public.app_contas_correntes() to authenticated;
grant execute on function public.app_pagar_periodo(date, date, int[]) to authenticated;
grant execute on function public.app_fluxo_diario(date, date, int[]) to authenticated;
grant execute on function public.app_pagar_segmentos(date, date) to authenticated;
