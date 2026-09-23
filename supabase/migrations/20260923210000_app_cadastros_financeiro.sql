-- B2 Gestão e Operações · tabelas do app que antes ficavam no navegador ou na memória.
--
--   app_perfis                     Perfis de acesso (permissões por menu). O campo "Função" do
--                                  usuário (app_usuarios.funcao) é o nome do perfil.
--   app_departamentos              Departamentos (app_usuarios.departamento é o nome).
--   app_saldo_contas_manual        Saldo inicial informado por conta corrente e dia
--                                  (tela Saldos bancários: manual, extrato ou planilha).
--   app_rec_financeiro_lancamento  Lançamentos manuais. Uma recorrência ("Mensal · 6x") vira
--                                  6 linhas com o mesmo grupo_id (parcela 1..6).
--
-- Acesso: leitura para membros do sistema (app_is_member); escrita conforme as permissões
-- do perfil (app_pode). O perfil de sistema "Administrador" tem acesso total e não pode ser
-- renomeado, inativado nem excluído.
--
-- Também cria app_pagos_diario(): valores efetivamente pagos, juros/multa e descontos por
-- data de pagamento (parcelas_pagar_payments), para o card de custo financeiro do painel.

-- ---------- auditoria ----------
create or replace function public.app_set_auditoria()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

-- ---------- perfis ----------
create table if not exists public.app_perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  descricao text,
  ativo boolean not null default true,
  -- {"financeiro.saldos": {"view": true, "edit": false}, ...} (chaves = menus do app)
  permissoes jsonb not null default '{}'::jsonb,
  sistema boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

create or replace function public.app_perfis_protege_sistema()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.sistema then
      raise exception 'O perfil % é do sistema e não pode ser excluído.', old.nome;
    end if;
    return old;
  end if;
  -- "sistema" só vem desta migration (auth.uid() nulo), nunca da API.
  if new.sistema and auth.uid() is not null and (tg_op = 'INSERT' or not old.sistema) then
    raise exception 'Não é possível marcar um perfil como perfil do sistema.';
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;
  if old.sistema and (new.nome <> old.nome or not new.ativo or not new.sistema) then
    raise exception 'O perfil % é do sistema: não pode ser renomeado nem inativado.', old.nome;
  end if;
  return new;
end;
$$;

drop trigger if exists app_perfis_protege_sistema on public.app_perfis;
create trigger app_perfis_protege_sistema
  before insert or update or delete on public.app_perfis
  for each row execute function public.app_perfis_protege_sistema();

drop trigger if exists app_perfis_auditoria on public.app_perfis;
create trigger app_perfis_auditoria
  before insert or update on public.app_perfis
  for each row execute function public.app_set_auditoria();

-- Perfis iniciais = as funções que a tela de usuários já usava.
do $$
declare
  fin text[] := array['financeiro.saldos', 'financeiro.lancamentos', 'financeiro.programacao', 'financeiro.fluxo'];
  todos text[] := fin || array['rh.colaboradores', 'rh.folha', 'veiculos', 'permutas.cadastro', 'permutas.acompanhamento',
    'vendas.propostas', 'vendas.contratos', 'cobranca', 'juridico', 'crc',
    'configuracoes.usuarios', 'configuracoes.departamentos', 'configuracoes.perfis', 'configuracoes.auditoria',
    'cadastros.clientes', 'cadastros.fornecedores', 'cadastros.imoveis', 'cadastros.contratos'];
begin
  insert into public.app_perfis (nome, descricao, sistema, permissoes)
  select v.nome, v.descricao, v.sistema,
         coalesce((select jsonb_object_agg(p, jsonb_build_object('view', true, 'edit', v.edita or p = any(v.editar)))
                     from unnest(v.ver || v.editar) p), '{}'::jsonb)
  from (values
    ('Administrador', 'Acesso total a todos os módulos, inclusive usuários e perfis.', true, todos, array[]::text[], true),
    ('Gestor Financeiro', 'Gestão de caixa, lançamentos, programação e fluxo financeiro.', false, array[]::text[], fin, false),
    ('Analista Financeiro', 'Saldos, lançamentos, programação do dia e fluxo de caixa.', false, array[]::text[], fin, false),
    ('Analista de RH', 'Colaboradores e folha de pagamento.', false, array[]::text[], array['rh.colaboradores', 'rh.folha'], false),
    ('Comercial', 'Propostas, contratos de venda e relacionamento com cliente.', false, array['financeiro.saldos'], array['vendas.propostas', 'vendas.contratos', 'crc'], false),
    ('Jurídico', 'Processos, distratos e consulta a contratos.', false, array['vendas.contratos'], array['juridico'], false),
    ('Controladoria', 'Consulta ao financeiro e auditoria.', false, fin || array['configuracoes.auditoria'], array[]::text[], false),
    ('Suporte', 'Consulta aos saldos bancários.', false, array['financeiro.saldos'], array[]::text[], false)
  ) as v(nome, descricao, sistema, ver, editar, edita)
  on conflict (nome) do nothing;
end;
$$;

-- Qualquer função já gravada em app_usuarios vira um perfil (sem permissões) antes da FK.
insert into public.app_perfis (nome)
select distinct funcao from public.app_usuarios
on conflict (nome) do nothing;

alter table public.app_usuarios drop constraint if exists app_usuarios_funcao_fkey;
alter table public.app_usuarios
  add constraint app_usuarios_funcao_fkey foreign key (funcao)
  references public.app_perfis (nome) on update cascade on delete restrict;

-- ---------- departamentos ----------
create table if not exists public.app_departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) > 0),
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

drop trigger if exists app_departamentos_auditoria on public.app_departamentos;
create trigger app_departamentos_auditoria
  before insert or update on public.app_departamentos
  for each row execute function public.app_set_auditoria();

insert into public.app_departamentos (nome, descricao) values
  ('Financeiro', 'Controle de fluxo de caixa, contas a pagar e a receber.'),
  ('RH', 'Recrutamento, folha de pagamento e benefícios.'),
  ('Comercial', 'Vendas, relacionamento com clientes e propostas.'),
  ('Jurídico', 'Contratos, compliance e questões regulatórias.'),
  ('Obras', 'Execução e acompanhamento de obras em andamento.'),
  ('TI', 'Infraestrutura, sistemas e suporte técnico.'),
  ('Controladoria', 'Auditoria interna e relatórios gerenciais.')
on conflict (nome) do nothing;

insert into public.app_departamentos (nome)
select distinct departamento from public.app_usuarios where departamento is not null
on conflict (nome) do nothing;

alter table public.app_usuarios drop constraint if exists app_usuarios_departamento_fkey;
alter table public.app_usuarios
  add constraint app_usuarios_departamento_fkey foreign key (departamento)
  references public.app_departamentos (nome) on update cascade on delete set null;

-- ---------- permissões ----------
create or replace function public.app_pode_usuario(p_user uuid, p_path text, p_editar boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_usuarios u
    join app_perfis p on p.nome = u.funcao
    where u.id = p_user and u.status <> 'inativo' and p.ativo
      and (p.sistema or coalesce((p.permissoes -> p_path ->> case when p_editar then 'edit' else 'view' end)::boolean, false))
  );
$$;

create or replace function public.app_pode(p_path text, p_editar boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_pode_usuario(auth.uid(), p_path, p_editar);
$$;

revoke all on function public.app_pode_usuario(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.app_pode_usuario(uuid, text, boolean) to service_role;
revoke all on function public.app_pode(text, boolean) from public, anon;
grant execute on function public.app_pode(text, boolean) to authenticated;

-- ---------- saldos informados ----------
create table if not exists public.app_saldo_contas_manual (
  id bigint generated always as identity primary key,
  data date not null,
  company_id integer not null,
  -- Chave da conta no app: "company_id|bank_number|agency_number|account_number" (contas_correntes)
  conta_id text not null,
  bank_number text,
  agency_number text,
  account_number text,
  saldo numeric(18, 2) not null,
  origem text not null default 'Manual' check (origem in ('Manual', 'Extrato bancário', 'Planilha')),
  obs text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null,
  unique (data, conta_id)
);
create index if not exists app_saldo_contas_manual_data_idx on public.app_saldo_contas_manual (data);

drop trigger if exists app_saldo_contas_manual_auditoria on public.app_saldo_contas_manual;
create trigger app_saldo_contas_manual_auditoria
  before insert or update on public.app_saldo_contas_manual
  for each row execute function public.app_set_auditoria();

-- ---------- lançamentos manuais ----------
create table if not exists public.app_rec_financeiro_lancamento (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  company_id integer not null,
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(18, 2) not null check (valor > 0),
  recorrencia text not null default 'Nenhuma' check (recorrencia in ('Nenhuma', 'Mensal', 'Semanal')),
  parcela integer not null default 1 check (parcela >= 1),
  total_parcelas integer not null default 1 check (total_parcelas >= 1 and total_parcelas <= 120),
  grupo_id uuid,
  situacao text not null default 'previsto' check (situacao in ('lancado', 'previsto')),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null,
  check (parcela <= total_parcelas)
);
create index if not exists app_rec_financeiro_lancamento_data_idx on public.app_rec_financeiro_lancamento (data);
create index if not exists app_rec_financeiro_lancamento_grupo_idx on public.app_rec_financeiro_lancamento (grupo_id) where grupo_id is not null;

drop trigger if exists app_rec_financeiro_lancamento_auditoria on public.app_rec_financeiro_lancamento;
create trigger app_rec_financeiro_lancamento_auditoria
  before insert or update on public.app_rec_financeiro_lancamento
  for each row execute function public.app_set_auditoria();

-- ---------- RLS e grants ----------
alter table public.app_perfis enable row level security;
alter table public.app_departamentos enable row level security;
alter table public.app_saldo_contas_manual enable row level security;
alter table public.app_rec_financeiro_lancamento enable row level security;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('app_perfis', 'configuracoes.perfis'),
      ('app_departamentos', 'configuracoes.departamentos'),
      ('app_saldo_contas_manual', 'financeiro.saldos'),
      ('app_rec_financeiro_lancamento', 'financeiro.lancamentos')
    ) v(tabela, caminho)
  loop
    execute format('drop policy if exists %I on public.%I', t.tabela || '_select', t.tabela);
    execute format('create policy %I on public.%I for select to authenticated using (public.app_is_member())', t.tabela || '_select', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_insert', t.tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.app_pode(%L, true))', t.tabela || '_insert', t.tabela, t.caminho);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_update', t.tabela);
    execute format('create policy %I on public.%I for update to authenticated using (public.app_pode(%L, true)) with check (public.app_pode(%L, true))', t.tabela || '_update', t.tabela, t.caminho, t.caminho);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_delete', t.tabela);
    execute format('create policy %I on public.%I for delete to authenticated using (public.app_pode(%L, true))', t.tabela || '_delete', t.tabela, t.caminho);
    execute format('revoke all on table public.%I from anon, authenticated', t.tabela);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t.tabela);
  end loop;
end;
$$;

-- ---------- pagos, juros e descontos por data de pagamento ----------
-- parcelas_pagar_payments (operação "Pagamento"), empresa vinda de parcelas_pagar_raw.
--   pago     = net_amount (o que saiu do banco)
--   juros    = interest_amount + fine_amount (juros + multa)
--   correcao = monetary_correction_amount
--   desconto = discount_amount
create or replace function public.app_pagos_diario(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform app_require_auth();
  if p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'periodo invalido';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', t.company_id,
           'dia', t.dia,
           'pago', t.pago,
           'juros', t.juros,
           'correcao', t.correcao,
           'desconto', t.desconto
         )), '[]'::jsonb)
    into result
  from (
    select r.company_id, p.payment_date as dia,
           sum(coalesce(p.net_amount, 0)) as pago,
           sum(coalesce(p.interest_amount, 0) + coalesce(p.fine_amount, 0)) as juros,
           sum(coalesce(p.monetary_correction_amount, 0)) as correcao,
           sum(coalesce(p.discount_amount, 0)) as desconto
    from parcelas_pagar_payments p
    join lateral (
      select x.company_id from parcelas_pagar_raw x where x.chave_parcela = p.chave_parcela limit 1
    ) r on true
    where p.operation_type_name = 'Pagamento'
      and p.payment_date between p_de and p_ate
    group by 1, 2
  ) t;
  return result;
end;
$$;

revoke all on function public.app_pagos_diario(date, date) from public, anon;
grant execute on function public.app_pagos_diario(date, date) to authenticated;
