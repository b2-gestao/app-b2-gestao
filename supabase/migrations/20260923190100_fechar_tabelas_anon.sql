-- Fecha o acesso direto às tabelas públicas para os papéis anon/authenticated.
--
-- Contexto: 34 tabelas do schema public estão com RLS desligado e com os grants
-- padrão do Supabase — qualquer pessoa com a chave anon (que vai no front-end)
-- consegue ler e alterar esses dados pela API REST. O front-end deste repositório
-- NÃO precisa desses grants: ele só usa as funções app_* (SECURITY DEFINER).
--
-- Impacto verificado em 23/09/2026 (logs da API + código):
--   * n8n (todos os workflows Sienge, SharePoint e Lara/SDR): chave service_role.
--   * GitHub python_bd_supabase: parcelas a pagar com SUPABASE_SERVICE_KEY (service_role);
--     parcelas a receber conecta direto no Postgres (SUPABASE_DB_PASSWORD).
--   * GitHub content-intel-base: usa OUTRO projeto Supabase (loalmtyouawldkxhymku).
--   * Edge function mcp-parcelas: conecta no Postgres e faz SET ROLE mcp_conector.
--   * Edge function resumo-unidades: service_role.
--   * Logs da API (edge_logs) de 14, 15, 20–21 e 23/09: nenhuma chamada com a chave
--     anon nem com usuário authenticated.
--   service_role, postgres e mcp_conector não são afetados por este script.
--   Se surgir uma integração nova com a chave anon, ela vai receber "permission denied".

-- Por que também mexe em DEFAULT PRIVILEGES: swap_parcelas_pagar_raw e
-- swap_parcelas_receber recriam as tabelas *_staging a cada sync; tabelas novas
-- herdam os default privileges. Sem isso o grant voltaria no sync seguinte.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'm')
      and c.relname not like 'app\_%'  -- tabelas do app têm grants/RLS próprios
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t.relname);
  end loop;
end;
$$;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- RLS não é ligado aqui de propósito: o papel mcp_conector (conector de consultas)
-- lê várias dessas tabelas sem policy e pararia de funcionar. Revogar os grants já
-- tira o acesso pela API REST.
