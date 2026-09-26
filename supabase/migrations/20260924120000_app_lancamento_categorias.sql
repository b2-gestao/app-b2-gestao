-- Cadastros › Financeiro › Categorias · categorias dos lançamentos manuais.
--
-- Antes a lista ficava fixa no código do app. Agora é cadastrada na tela Categorias e
-- app_rec_financeiro_lancamento.categoria passa a ser o nome da categoria (FK com
-- on update cascade: renomear a categoria renomeia os lançamentos). Categoria em uso não
-- pode ser excluída, só inativada (inativa some do formulário de novo lançamento).
--
-- Acesso: leitura para membros do sistema; escrita para quem pode editar
-- cadastros.categorias. Perfis que já editam lançamentos manuais ganham essa permissão.

create table if not exists public.app_lancamento_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists app_lancamento_categorias_auditoria on public.app_lancamento_categorias;
create trigger app_lancamento_categorias_auditoria
  before insert or update on public.app_lancamento_categorias
  for each row execute function public.app_set_auditoria();

-- Categorias que o app usava + qualquer categoria já gravada nos lançamentos.
insert into public.app_lancamento_categorias (nome) values
  ('VMD'), ('Fator recompra'), ('Juros P.E'), ('RET'), ('Tarifas bancárias'), ('Reembolso'),
  ('Taxa Administração'), ('Taxa Engenharia'), ('Outros')
on conflict (nome) do nothing;

insert into public.app_lancamento_categorias (nome)
select distinct categoria from public.app_rec_financeiro_lancamento
on conflict (nome) do nothing;

alter table public.app_rec_financeiro_lancamento drop constraint if exists app_rec_financeiro_lancamento_categoria_fkey;
alter table public.app_rec_financeiro_lancamento
  add constraint app_rec_financeiro_lancamento_categoria_fkey foreign key (categoria)
  references public.app_lancamento_categorias (nome) on update cascade on delete restrict;

alter table public.app_lancamento_categorias enable row level security;

drop policy if exists app_lancamento_categorias_select on public.app_lancamento_categorias;
create policy app_lancamento_categorias_select on public.app_lancamento_categorias
  for select to authenticated using (public.app_is_member());
drop policy if exists app_lancamento_categorias_insert on public.app_lancamento_categorias;
create policy app_lancamento_categorias_insert on public.app_lancamento_categorias
  for insert to authenticated with check (public.app_pode('cadastros.categorias', true));
drop policy if exists app_lancamento_categorias_update on public.app_lancamento_categorias;
create policy app_lancamento_categorias_update on public.app_lancamento_categorias
  for update to authenticated using (public.app_pode('cadastros.categorias', true)) with check (public.app_pode('cadastros.categorias', true));
drop policy if exists app_lancamento_categorias_delete on public.app_lancamento_categorias;
create policy app_lancamento_categorias_delete on public.app_lancamento_categorias
  for delete to authenticated using (public.app_pode('cadastros.categorias', true));

revoke all on table public.app_lancamento_categorias from anon, authenticated;
grant select, insert, update, delete on table public.app_lancamento_categorias to authenticated;

-- Quem edita lançamentos manuais também cadastra categorias.
update public.app_perfis
set permissoes = permissoes || jsonb_build_object('cadastros.categorias', jsonb_build_object('view', true, 'edit', true))
where not sistema and coalesce((permissoes -> 'financeiro.lancamentos' ->> 'edit')::boolean, false)
  and not (permissoes ? 'cadastros.categorias');
