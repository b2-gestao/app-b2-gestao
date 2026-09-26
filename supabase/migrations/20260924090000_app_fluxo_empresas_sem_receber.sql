-- Fluxo de caixa · empresas cujas parcelas a receber não entram nas receitas.
--
-- Algumas empresas têm os recebíveis 100% comprometidos (ex.: empresa 231); para elas o
-- fluxo de caixa zera a linha "Receitas" (parcelas_receber), mesmo que haja parcelas em
-- aberto. Configurado pela engrenagem da tela Fluxo de caixa. O filtro é aplicado no app
-- (só no fluxo de caixa); app_fluxo_diario e o Painel continuam iguais.
--
-- Acesso: leitura para membros do sistema; escrita para quem pode editar financeiro.fluxo.

create table if not exists public.app_fluxo_empresas_sem_receber (
  company_id integer primary key,
  motivo text not null check (length(trim(motivo)) > 0),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists app_fluxo_empresas_sem_receber_auditoria on public.app_fluxo_empresas_sem_receber;
create trigger app_fluxo_empresas_sem_receber_auditoria
  before insert or update on public.app_fluxo_empresas_sem_receber
  for each row execute function public.app_set_auditoria();

alter table public.app_fluxo_empresas_sem_receber enable row level security;

drop policy if exists app_fluxo_empresas_sem_receber_select on public.app_fluxo_empresas_sem_receber;
create policy app_fluxo_empresas_sem_receber_select on public.app_fluxo_empresas_sem_receber
  for select to authenticated using (public.app_is_member());
drop policy if exists app_fluxo_empresas_sem_receber_insert on public.app_fluxo_empresas_sem_receber;
create policy app_fluxo_empresas_sem_receber_insert on public.app_fluxo_empresas_sem_receber
  for insert to authenticated with check (public.app_pode('financeiro.fluxo', true));
drop policy if exists app_fluxo_empresas_sem_receber_update on public.app_fluxo_empresas_sem_receber;
create policy app_fluxo_empresas_sem_receber_update on public.app_fluxo_empresas_sem_receber
  for update to authenticated using (public.app_pode('financeiro.fluxo', true)) with check (public.app_pode('financeiro.fluxo', true));
drop policy if exists app_fluxo_empresas_sem_receber_delete on public.app_fluxo_empresas_sem_receber;
create policy app_fluxo_empresas_sem_receber_delete on public.app_fluxo_empresas_sem_receber
  for delete to authenticated using (public.app_pode('financeiro.fluxo', true));

revoke all on table public.app_fluxo_empresas_sem_receber from anon, authenticated;
grant select, insert, update, delete on table public.app_fluxo_empresas_sem_receber to authenticated;
