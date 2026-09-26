-- Documento de previsão (forecast_document = 'S') não entra em nenhuma tela do financeiro
-- nem no Painel. mv_parcelas_pagar já exclui desde 20260922112947; as RPCs do app liam
-- parcelas_pagar_raw direto e traziam esses documentos (24/09–25/10: R$ 5,3 mi de R$ 15,7 mi).
-- O resto de cada função fica idêntico ao que está em produção.

create or replace function public.app_fluxo_diario(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result jsonb;
  lock_antes text := current_setting('lock_timeout');
  -- %1$I tabela, %2$I saldo em aberto, %3$I valor original, %4$I saldo corrigido
  sql text := $q$
  with rec as (
    select r.company_id, r.due_date as dia,
           sum(r.%2$I) filter (where r.%2$I > 0) as receber_aberto,
           sum(r.%3$I) as receber_original
    from %1$I r
    where r.due_date between $1 and $2
      and ($3 is null or r.company_id = any($3))
    group by 1, 2
  ),
  caixa as (
    select r.company_id, r.due_date + 2 as dia,
           sum(coalesce(r.%4$I, r.%2$I)) as receber_caixa
    from %1$I r
    left join payment_term_descriptions ptd on ptd.payment_term_id = r.payment_term_id
    where r.due_date between $1 - 2 and $2 - 2
      and r.%2$I > 0
      and ($3 is null or r.company_id = any($3))
      and coalesce(ptd.grupo_parcela, '') not in ('Bens', 'Permuta', 'Financiamento')
      and not exists (select 1 from app_fluxo_empresas_sem_receber s where s.company_id = r.company_id)
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
    where p.due_date between $1 and $2
      and p.forecast_document is distinct from 'S'
      and ($3 is null or p.company_id = any($3))
    group by 1, 2
  ),
  chaves as (
    select company_id, dia from rec
    union select company_id, dia from caixa
    union select company_id, dia from pag
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', k.company_id,
           'dia', k.dia,
           'receber_aberto', coalesce(rec.receber_aberto, 0),
           'receber_original', coalesce(rec.receber_original, 0),
           'receber_caixa', coalesce(caixa.receber_caixa, 0),
           'pagar_aberto', coalesce(pag.pagar_aberto, 0),
           'pagar_original', coalesce(pag.pagar_original, 0),
           'pagar_quitado', coalesce(pag.pagar_quitado, 0),
           'pagar_desconto', coalesce(pag.pagar_desconto, 0),
           'pagar_correcao', coalesce(pag.pagar_correcao, 0)
         )), '[]'::jsonb)
  from chaves k
  left join rec on rec.company_id = k.company_id and rec.dia = k.dia
  left join caixa on caixa.company_id = k.company_id and caixa.dia = k.dia
  left join pag on pag.company_id = k.company_id and pag.dia = k.dia
  $q$;
begin
  perform app_require_auth();
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;

  begin
    perform set_config('lock_timeout', '200ms', true);
    execute format(sql, 'mv_parcelas_receber', 'saldo_aberto', 'valor_original', 'saldo_aberto_corrigido') into result using p_de, p_ate, p_empresas;
  exception when lock_not_available then
    -- MV em REFRESH: lê a tabela de origem (mais lenta, sempre atual).
    execute format(sql, 'parcelas_receber', 'balance_amount', 'original_amount', 'corrected_balance_amount') into result using p_de, p_ate, p_empresas;
  end;
  perform set_config('lock_timeout', lock_antes, true);
  return result;
end;
$$;

revoke all on function public.app_fluxo_diario(date, date, int[]) from public, anon;
grant execute on function public.app_fluxo_diario(date, date, int[]) to authenticated;

create or replace function public.app_pagar_periodo(p_de date, p_ate date, p_empresas integer[] default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    and p.forecast_document is distinct from 'S'
    and p.due_date between p_de and p_ate
    and (p_empresas is null or p.company_id = any(p_empresas));
  return result;
end;
$function$;

create or replace function public.app_pagar_segmentos(p_de date, p_ate date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
      and p.forecast_document is distinct from 'S'
    group by 1, 2
  ) t;
  return result;
end;
$function$;

create or replace function public.app_pagos_diario(p_de date, p_ate date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
begin
  perform app_require_auth();
  if p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'periodo invalido';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', t.company_id,
           'dia', t.dia,
           'pago', t.pago,
           'juros', t.juros,
           'correcao', t.correcao,
           'desconto', t.desconto
         )), '[]'::jsonb)
    into result
  from (
    select r.company_id, p.payment_date as dia,
           sum(coalesce(p.net_amount, 0)) as pago,
           sum(coalesce(p.interest_amount, 0) + coalesce(p.fine_amount, 0)) as juros,
           sum(coalesce(p.monetary_correction_amount, 0)) as correcao,
           sum(coalesce(p.discount_amount, 0)) as desconto
    from parcelas_pagar_payments p
    join lateral (
      select x.company_id from parcelas_pagar_raw x
      where x.chave_parcela = p.chave_parcela and x.forecast_document is distinct from 'S'
      limit 1
    ) r on true
    where p.operation_type_name = 'Pagamento'
      and p.payment_date between p_de and p_ate
    group by 1, 2
  ) t;
  return result;
end;
$function$;
