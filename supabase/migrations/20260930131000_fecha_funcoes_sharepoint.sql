-- Mesmo problema de 20260925110000_fecha_funcoes_carga: as funções da carga "Sharepoint -
-- Situacao-Unidades" (n8n) eram executáveis por anon/authenticated via /rest/v1/rpc, e qualquer
-- um com a chave pública podia esvaziar a staging ou disparar o swap. Os logs da API de 29/09
-- mostram só chamadas do n8n com service_role. Fica só service_role.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.truncate_situacao_unidades_sharepoint_staging()',
    'public.swap_situacao_unidades_sharepoint()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
