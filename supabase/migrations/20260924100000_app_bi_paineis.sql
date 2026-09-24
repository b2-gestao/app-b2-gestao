-- BI · painéis do Power BI publicados na web ("Publicar na Web" → link público).
--
-- Cada linha vira um submenu da seção BI; ao clicar, o app abre a URL num iframe.
-- Sem back-end próprio: o app lê e grava esta tabela direto, protegida por RLS.
--
-- Permissões (app_perfis.permissoes):
--   bi.gerenciar  (editar) ... cadastra, altera, reordena e exclui painéis; vê todos.
--   bi.<id>       (ver) ...... vê o painel <id> no menu. Marcado por painel em Configurações › Perfis.
-- O perfil de sistema (Administrador) vê e gerencia tudo.
-- A leitura também é filtrada aqui, então a URL de um painel não chega a quem não tem acesso.

create table if not exists public.app_bi_paineis (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  url text not null check (url ~* '^https://'),
  ordem integer not null default 0,
  ativo boolean not null default true,
  -- Recorta a barra inferior do Power BI (compartilhar, zoom, marca). Desligue se o
  -- relatório usa a navegação de páginas dessa barra.
  ocultar_rodape boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists app_bi_paineis_auditoria on public.app_bi_paineis;
create trigger app_bi_paineis_auditoria
  before insert or update on public.app_bi_paineis
  for each row execute function public.app_set_auditoria();

alter table public.app_bi_paineis enable row level security;

drop policy if exists app_bi_paineis_select on public.app_bi_paineis;
create policy app_bi_paineis_select on public.app_bi_paineis
  for select to authenticated using (
    public.app_is_member()
    and (public.app_pode('bi.gerenciar', true) or (ativo and public.app_pode('bi.' || id::text)))
  );
drop policy if exists app_bi_paineis_insert on public.app_bi_paineis;
create policy app_bi_paineis_insert on public.app_bi_paineis
  for insert to authenticated with check (public.app_pode('bi.gerenciar', true));
drop policy if exists app_bi_paineis_update on public.app_bi_paineis;
create policy app_bi_paineis_update on public.app_bi_paineis
  for update to authenticated using (public.app_pode('bi.gerenciar', true)) with check (public.app_pode('bi.gerenciar', true));
drop policy if exists app_bi_paineis_delete on public.app_bi_paineis;
create policy app_bi_paineis_delete on public.app_bi_paineis
  for delete to authenticated using (public.app_pode('bi.gerenciar', true));

revoke all on table public.app_bi_paineis from anon, authenticated;
grant select, insert, update, delete on table public.app_bi_paineis to authenticated;
