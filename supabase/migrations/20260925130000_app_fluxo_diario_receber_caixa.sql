-- app_fluxo_diario: novo campo receber_caixa com as regras do fluxo de caixa do financeiro
-- (batido com a planilha FLUXO DE CAIXA 24.09.2026, período 26/09–05/10):
--   * saldo em aberto CORRIGIDO da parcela;
--   * entra no caixa em D+2 corridos do vencimento;
--   * fora parcelas com grupo Bens, Permuta ou Financiamento (payment_term_descriptions);
--   * fora empresas de app_fluxo_empresas_sem_receber (plano empresário, CRI).
-- receber_aberto / receber_original continuam iguais (no vencimento) para o Painel.

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
