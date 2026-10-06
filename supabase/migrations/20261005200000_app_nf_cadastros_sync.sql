-- Notas Fiscais › Cadastros: sincronização com o Sienge.
--
-- A lista lê app_nf_cadastros, gravada no momento do cadastro. Quando a nota é excluída no
-- Sienge, a linha continuava aparecendo. A edge function app-nf (ação "sincronizar") confere
-- cada nota no Sienge e marca excluida_no_sienge_em quando ela não existe mais; a tela oculta
-- essas linhas, e o registro fica no banco para auditoria.
--
-- Disparo: pg_cron a cada 15 minutos, chamando a edge function via pg_net.
-- Configuração única, fora do controle de versão (segredos), no Vault do projeto:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/app-nf', 'app_nf_sync_url');
--   select vault.create_secret('<service_role key>', 'app_nf_sync_key');
-- Sem esses segredos o job não faz nada.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.app_nf_cadastros
  add column if not exists excluida_no_sienge_em timestamptz,
  add column if not exists verificada_em timestamptz;

-- Linhas a verificar: as não excluídas, das menos recentemente conferidas para as mais.
create index if not exists app_nf_cadastros_sync_idx
  on public.app_nf_cadastros (verificada_em nulls first)
  where excluida_no_sienge_em is null;

create or replace function public.app_nf_sync_disparar()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_nf_sync_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'app_nf_sync_key';
  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('acao', 'sincronizar'),
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.app_nf_sync_disparar() from public, anon, authenticated;
grant execute on function public.app_nf_sync_disparar() to service_role;

select cron.unschedule('app-nf-sincronizar')
where exists (select 1 from cron.job where jobname = 'app-nf-sincronizar');

select cron.schedule('app-nf-sincronizar', '*/15 * * * *', $$select public.app_nf_sync_disparar()$$);
