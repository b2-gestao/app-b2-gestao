-- app_receber_periodo: parcelas a receber em aberto no período, por empresa.
--
-- Usada pela Programação do dia, que soma esse valor ao saldo das contas no "Saldo
-- inicial do dia". Ficam de fora as condições que não viram caixa: grupo_parcela
-- Bens (BE/BI/BM), Permuta (PE/PN/PR/PT) e Financiamento (FI), conforme
-- payment_term_descriptions. As empresas com plano empresário vigente
-- (app_fluxo_empresas_sem_receber) são tiradas no app, como no Fluxo de caixa.
--
-- Mesmo padrão de app_fluxo_diario: lê mv_parcelas_receber e, se a MV estiver em
-- REFRESH (lock > 200 ms), cai para parcelas_receber.

create or replace function public.app_receber_periodo(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result jsonb;
  lock_antes text := current_setting('lock_timeout');
  -- %1$I tabela, %2$I saldo em aberto
  sql text := $q$
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', x.company_id,
           'receber_aberto', x.receber_aberto,
           'parcelas', x.parcelas
         )), '[]'::jsonb)
  from (
    select r.company_id,
           sum(r.%2$I) as receber_aberto,
           count(*) as parcelas
    from %1$I r
    left join payment_term_descriptions ptd on ptd.payment_term_id = r.payment_term_id
    where r.due_date between $1 and $2
      and r.%2$I > 0
      and ($3 is null or r.company_id = any($3))
      and coalesce(ptd.grupo_parcela, '') not in ('Bens', 'Permuta', 'Financiamento')
    group by 1
  ) x
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
    execute format(sql, 'mv_parcelas_receber', 'saldo_aberto') into result using p_de, p_ate, p_empresas;
  exception when lock_not_available then
    execute format(sql, 'parcelas_receber', 'balance_amount') into result using p_de, p_ate, p_empresas;
  end;
  perform set_config('lock_timeout', lock_antes, true);
  return result;
end;
$$;

revoke all on function public.app_receber_periodo(date, date, int[]) from public, anon;
grant execute on function public.app_receber_periodo(date, date, int[]) to authenticated;
