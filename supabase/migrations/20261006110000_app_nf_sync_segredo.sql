-- Notas Fiscais › Cadastros: a sincronização com o Sienge passa a usar um segredo próprio.
--
-- Antes, o pg_cron chamava a edge function app-nf com a chave service_role guardada no Vault
-- (app_nf_sync_key). Agora app_nf_sync_key é um segredo aleatório gerado aqui, que só serve para
-- disparar a ação "sincronizar": a service_role não fica guardada no banco.
--
-- A chamada leva a chave anon no Authorization (o gateway exige um JWT, verify_jwt = true) e o
-- segredo no cabeçalho x-app-nf-sync; a edge function confere o segredo por app_nf_sync_segredo(),
-- que só a service_role executa.
--
-- Configuração única, fora do controle de versão, no Vault do projeto:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/app-nf', 'app_nf_sync_url');
--   select vault.create_secret('<chave anon do projeto>', 'app_nf_sync_anon');
-- Sem esses segredos o job não faz nada.

-- Segredo da sincronização, gerado no banco (só se ainda não existir).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_nf_sync_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'app_nf_sync_key',
      'Segredo que autoriza o pg_cron a disparar a sincronização da app-nf'
    );
  end if;
end;
$$;

-- Lido pela edge function (client service_role) para conferir o cabeçalho x-app-nf-sync.
create or replace function public.app_nf_sync_segredo()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'app_nf_sync_key';
$$;

revoke all on function public.app_nf_sync_segredo() from public, anon, authenticated;
grant execute on function public.app_nf_sync_segredo() to service_role;

create or replace function public.app_nf_sync_disparar()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_url text;
  v_anon text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_nf_sync_url';
  select decrypted_secret into v_anon from vault.decrypted_secrets where name = 'app_nf_sync_anon';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'app_nf_sync_key';
  if coalesce(v_url, '') = '' or coalesce(v_anon, '') = '' or coalesce(v_segredo, '') = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-app-nf-sync', v_segredo
    ),
    body := jsonb_build_object('acao', 'sincronizar'),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.app_nf_sync_disparar() from public, anon, authenticated;
grant execute on function public.app_nf_sync_disparar() to service_role;
