-- app_fluxo_diario: parcelas a receber passam a vir de mv_parcelas_receber.
--
-- Medição de 23/09 (transações desfeitas, sem sync rodando):
--   parcelas_receber, sem índice por data ........ 4,5–5,5 s (limite do papel authenticated: 8 s)
--   mv_parcelas_receber (índices por due_date) ... 1ª execução 71 ms / 2 s; depois 1 ms / 22 ms
-- A MV é atualizada pelo pg_cron 30–60 min depois de cada carga do receber, com os mesmos
-- totais. O REFRESH dela (sem CONCURRENTLY, de propósito) bloqueia leituras por ~5 min duas
-- vezes ao dia; nesse intervalo a função espera no máximo 200 ms e lê parcelas_receber
-- como antes. Nada muda no sync, no n8n, no GitHub Actions nem no MCP.
--
-- VOLATILE porque ajusta lock_timeout (set_config) durante a execução.

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
  -- %1$I tabela, %2$I saldo em aberto, %3$I valor original
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
  pag as (
    select p.company_id, p.due_date as dia,
           sum(p.balance_amount) filter (where p.balance_amount > 0) as pagar_aberto,
           sum(p.original_amount) as pagar_original,
           sum(p.original_amount - coalesce(p.balance_amount, 0)) as pagar_quitado,
           sum(coalesce(p.discount_amount, 0)) as pagar_desconto,
           sum(greatest(coalesce(p.corrected_balance_amount, 0) - coalesce(p.balance_amount, 0), 0)) as pagar_correcao
    from parcelas_pagar_raw p
    where p.due_date between $1 and $2
      and ($3 is null or p.company_id = any($3))
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
  from rec
  full join pag on pag.company_id = rec.company_id and pag.dia = rec.dia
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
    execute format(sql, 'mv_parcelas_receber', 'saldo_aberto', 'valor_original') into result using p_de, p_ate, p_empresas;
  exception when lock_not_available then
    -- MV em REFRESH: lê a tabela de origem (mais lenta, sempre atual).
    execute format(sql, 'parcelas_receber', 'balance_amount', 'original_amount') into result using p_de, p_ate, p_empresas;
  end;
  perform set_config('lock_timeout', lock_antes, true);
  return result;
end;
$$;

revoke all on function public.app_fluxo_diario(date, date, int[]) from public, anon;
grant execute on function public.app_fluxo_diario(date, date, int[]) to authenticated;
