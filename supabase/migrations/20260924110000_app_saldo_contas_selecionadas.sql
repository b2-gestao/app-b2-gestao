-- Contas correntes que aparecem na tela Financeiro > Saldos bancários.
-- Só as contas adicionadas aqui entram na listagem; a chave (conta_id) é a mesma de app_saldo_contas_manual:
-- "company_id|bank_number|agency_number|account_number" (contas_correntes).
create table if not exists public.app_saldo_contas_selecionadas (
  conta_id text primary key,
  company_id integer not null,
  bank_number text,
  agency_number text,
  account_number text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.app_saldo_contas_selecionadas enable row level security;

drop policy if exists app_saldo_contas_selecionadas_select on public.app_saldo_contas_selecionadas;
create policy app_saldo_contas_selecionadas_select on public.app_saldo_contas_selecionadas
  for select to authenticated using (public.app_is_member());
drop policy if exists app_saldo_contas_selecionadas_insert on public.app_saldo_contas_selecionadas;
create policy app_saldo_contas_selecionadas_insert on public.app_saldo_contas_selecionadas
  for insert to authenticated with check (public.app_pode('financeiro.saldos', true));
drop policy if exists app_saldo_contas_selecionadas_delete on public.app_saldo_contas_selecionadas;
create policy app_saldo_contas_selecionadas_delete on public.app_saldo_contas_selecionadas
  for delete to authenticated using (public.app_pode('financeiro.saldos', true));

revoke all on table public.app_saldo_contas_selecionadas from anon, authenticated;
grant select, insert, delete on table public.app_saldo_contas_selecionadas to authenticated;
