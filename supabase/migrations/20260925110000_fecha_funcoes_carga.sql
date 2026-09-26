-- Funções das cargas do Sienge/SharePoint (n8n, GitHub Actions) estavam executáveis por anon e
-- authenticated via /rest/v1/rpc: qualquer um com a chave pública podia esvaziar ou trocar tabelas.
-- Os logs mostram só chamadas com service_role; o pg_cron roda como postgres (dono). Fica só service_role.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.truncate_parcelas_pagar_raw_staging()',
    'public.truncate_parcelas_receber_staging()',
    'public.swap_parcelas_pagar_raw()',
    'public.swap_parcelas_receber()',
    'public.delete_parcelas_receber_by_keys(jsonb)',
    'public.expand_parcela_pagar_raw()',
    'public.refresh_mv_parcelas_pagar_pos_carga()',
    'public.refresh_mv_parcelas_receber()',
    'public.sharepoint_upsert_row(text,jsonb,text,integer,text)',
    'public.sharepoint_finalizar_carga(text,text,text[])'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
