-- Permutas › Cadastro: áreas recebidas em permuta e as unidades dadas em troca (antes um painel
-- avulso no claude.ai, "Painel de Permutas").
--
--   negocios_permuta       Negócios/empreendimentos que ainda não são empresa no Sienge. Aparecem no
--                          seletor "Nome da área / empreendimento" junto com as empresas.
--   app_permutas           Um registro por permutante: origem (empresa do Sienge OU negócio), matrícula,
--                          coeficiente, % de permuta e a parte paga no próprio empreendimento.
--                          Os resultados (aproveitamento, área de permuta, emp. diversos) não são
--                          gravados: o app calcula, como no painel original.
--   app_permuta_unidades   Unidades dadas em troca. A unidade vem da tabela unidades (Sienge); nome e
--                          área privativa são copiados no momento do vínculo. valor_unidade fica
--                          pronto, com a fonte ainda a definir.
--   app_permuta_empreendimentos  Ficha de cada empreendimento/terreno na Visão Geral: tipo, tipo de permuta,
--                          status, alerta curto e ação. Ligado à unidade do Sienge (enterprise_id) ou só nome.
--   app_permuta_unidades_diretas Unidades permutadas cadastradas direto (sem permuta de área): empreendimento,
--                          unidade, metragem, permutante, data do contrato e observação.
--   app_permuta_anexos     Documentos (Contrato, Escritura, Matrícula, Aditivo ou Outro, com descrição
--                          obrigatória). O arquivo fica no bucket privado app-permutas, até 50 MB.
--
-- Acesso: Permutas › Terrenos › Cadastros (permutas.cadastro) ou › Visão Geral (permutas.visao).
-- Ler exige ver em um dos dois; gravar exige editar em um dos dois.

-- ---------- negócios de permuta ----------
create table if not exists public.negocios_permuta (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
create unique index if not exists negocios_permuta_nome_uidx on public.negocios_permuta (lower(btrim(nome)));

-- ---------- permutas ----------
create table if not exists public.app_permutas (
  id uuid primary key default gen_random_uuid(),
  empresa_id integer,
  negocio_id uuid references public.negocios_permuta (id) on delete restrict,
  permutante text not null check (length(btrim(permutante)) > 0),
  num_matricula text,
  area_matricula numeric(16, 4),
  coeficiente numeric(10, 4),
  -- fração: 0,12 = 12%
  pct_permuta numeric(12, 8),
  area_propria numeric(16, 4),
  -- só vale quando falta matrícula, coeficiente ou %
  area_informada numeric(16, 4),
  observacao text,
  pendencia text,
  data_contrato date,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null,
  constraint app_permutas_origem_ck check ((empresa_id is null) <> (negocio_id is null))
);
create index if not exists app_permutas_empresa_idx on public.app_permutas (empresa_id);
create index if not exists app_permutas_negocio_idx on public.app_permutas (negocio_id);

create table if not exists public.app_permuta_unidades (
  id uuid primary key default gen_random_uuid(),
  permuta_id uuid not null references public.app_permutas (id) on delete cascade,
  enterprise_id integer not null,
  unidade_id integer not null,
  unidade_nome text not null,
  area_privativa numeric(16, 4),
  valor_unidade numeric(18, 2),
  ordem integer not null default 0,
  unique (permuta_id, unidade_id)
);
create index if not exists app_permuta_unidades_permuta_idx on public.app_permuta_unidades (permuta_id);

create table if not exists public.app_permuta_empreendimentos (
  id uuid primary key default gen_random_uuid(),
  enterprise_id integer unique,
  nome text not null check (length(btrim(nome)) > 0),
  tipo text check (tipo is null or tipo in ('Vertical', 'Horizontal', 'Loteamento')),
  tipo_permuta text,
  status text,
  alerta text,
  acao text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

create table if not exists public.app_permuta_unidades_diretas (
  id uuid primary key default gen_random_uuid(),
  enterprise_id integer not null,
  unidade_id integer,
  unidade_nome text not null check (length(btrim(unidade_nome)) > 0),
  area_privativa numeric(16, 4),
  valor_unidade numeric(18, 2),
  permutante text,
  data_contrato date,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
create index if not exists app_permuta_unidades_diretas_emp_idx on public.app_permuta_unidades_diretas (enterprise_id);

create table if not exists public.app_permuta_anexos (
  id uuid primary key default gen_random_uuid(),
  permuta_id uuid not null references public.app_permutas (id) on delete cascade,
  tipo text not null check (tipo in ('Contrato', 'Escritura', 'Matrícula', 'Aditivo', 'Outro')),
  descricao text,
  nome text not null,
  mime text not null default '',
  tamanho bigint not null default 0,
  -- caminho no bucket app-permutas: <permuta_id>/<id do anexo>-<nome>
  storage_path text not null,
  adicionado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  constraint app_permuta_anexos_outro_ck check (tipo <> 'Outro' or length(btrim(coalesce(descricao, ''))) > 0)
);
create index if not exists app_permuta_anexos_permuta_idx on public.app_permuta_anexos (permuta_id);

-- ---------- auditoria ----------
do $$
declare
  t text;
begin
  foreach t in array array['negocios_permuta', 'app_permutas', 'app_permuta_empreendimentos', 'app_permuta_unidades_diretas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.app_set_auditoria()', t || '_auditoria', t);
  end loop;
end;
$$;

-- ---------- acesso ----------
create or replace function public.app_permutas_pode(p_editar boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $f$
  select app_pode('permutas.cadastro', p_editar) or app_pode('permutas.visao', p_editar);
$f$;
revoke all on function public.app_permutas_pode(boolean) from public, anon;
grant execute on function public.app_permutas_pode(boolean) to authenticated;

do $
declare
  t text;
begin
  foreach t in array array['negocios_permuta', 'app_permutas', 'app_permuta_unidades', 'app_permuta_anexos',
                           'app_permuta_empreendimentos', 'app_permuta_unidades_diretas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.app_is_member() and public.app_permutas_pode())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.app_permutas_pode(true))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.app_permutas_pode(true)) with check (public.app_permutas_pode(true))', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.app_permutas_pode(true))', t || '_delete', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------- catálogo de unidades ----------
-- Unidades do Sienge (tabela unidades) com o nome do empreendimento pelo de-para. Sem nome no de-para,
-- o app mostra "Empreendimento <código>". company_id (cd_empresa do de-para) diz quais empreendimentos
-- são "próprios" de uma empresa. entrega = maior data de entrega das unidades do empreendimento (Insights).
create or replace function public.app_permutas_unidades()
returns table (enterprise_id integer, empreendimento text, company_id integer, unidade_id integer, unidade text, area_privativa numeric, entrega date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_require_auth();
  if not app_permutas_pode() then
    raise exception 'Sem permissão para Permutas › Cadastro.' using errcode = '42501';
  end if;
  return query
  select u.enterprise_id, d.nome, d.cd_empresa, u.id, u.name, u.private_area,
         max(u.delivery_date) over (partition by u.enterprise_id)
  from unidades u
  left join lateral (
    select dp.nome, dp.cd_empresa
    from de_para_sharepoint dp
    where dp.cd_empreendimento_centro_de_custo = u.enterprise_id::text
    order by dp.id
    limit 1
  ) d on true
  where u.enterprise_id is not null and u.name is not null
  order by u.enterprise_id, u.name;
end;
$$;
revoke all on function public.app_permutas_unidades() from public, anon;
grant execute on function public.app_permutas_unidades() to authenticated;

-- ---------- anexos (Storage) ----------
-- Bucket privado; o primeiro nível da pasta é o id da permuta.
insert into storage.buckets (id, name, public, file_size_limit)
values ('app-permutas', 'app-permutas', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists app_permutas_select on storage.objects;
drop policy if exists app_permutas_insert on storage.objects;
drop policy if exists app_permutas_update on storage.objects;
drop policy if exists app_permutas_delete on storage.objects;

create policy app_permutas_select on storage.objects for select to authenticated
  using (bucket_id = 'app-permutas' and public.app_is_member() and public.app_permutas_pode());
create policy app_permutas_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'app-permutas' and public.app_permutas_pode(true));
create policy app_permutas_update on storage.objects for update to authenticated
  using (bucket_id = 'app-permutas' and public.app_permutas_pode(true))
  with check (bucket_id = 'app-permutas' and public.app_permutas_pode(true));
create policy app_permutas_delete on storage.objects for delete to authenticated
  using (bucket_id = 'app-permutas' and public.app_permutas_pode(true));
