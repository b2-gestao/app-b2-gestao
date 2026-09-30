-- Acesso por empresa: cada usuário vê e altera só as empresas liberadas para ele.
--
-- A liberação fica no perfil (app_perfis), com exceções no usuário (app_usuarios):
--   vê todas = perfil de sistema (Administrador) OU perfil.todas_empresas OU usuario.todas_empresas
--   senão    = perfil.empresas ∪ usuario.empresas (empresas adicionais)
-- app_usuarios.empresas já existia (tela Configurações › Usuários), mas nada a aplicava.
--
-- Os perfis existentes entram com todas_empresas = true: nada muda até um perfil ser restringido.
--
-- Onde a regra é aplicada:
--   * RPCs de leitura (app_empresas, app_centros_custo, app_contas_correntes, app_pagar_periodo,
--     app_fluxo_diario, app_receber_periodo, app_pagar_segmentos, app_pagos_diario): mesmas
--     definições de antes, só com o filtro de empresas.
--   * RLS das tabelas do app que têm empresa.
--   * Edge functions app-usuarios (quem concede o quê) e app-nf (app_pode_empresa).

alter table public.app_perfis add column if not exists todas_empresas boolean not null default false;
alter table public.app_perfis add column if not exists empresas integer[] not null default '{}';
alter table public.app_usuarios add column if not exists todas_empresas boolean not null default false;

update public.app_perfis set todas_empresas = true;

-- ---------- funções de acesso ----------
create or replace function public.app_todas_empresas_usuario(p_user uuid)
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
      and (p.sistema or p.todas_empresas or u.todas_empresas)
  );
$$;

-- Empresas liberadas (perfil ∪ usuário). Só vale para quem não tem acesso a todas.
create or replace function public.app_empresas_usuario(p_user uuid)
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select array(select distinct e from unnest(p.empresas || u.empresas) e order by e)
    from app_usuarios u
    join app_perfis p on p.nome = u.funcao
    where u.id = p_user and u.status <> 'inativo' and p.ativo
  ), '{}'::integer[]);
$$;

create or replace function public.app_todas_empresas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_todas_empresas_usuario(auth.uid());
$$;

create or replace function public.app_pode_empresa(p_company integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_todas_empresas_usuario(auth.uid()) or p_company = any(app_empresas_usuario(auth.uid()));
$$;

-- Filtro de empresas das RPCs: nulo = todas (só para quem tem acesso a todas); para os demais,
-- as empresas pedidas que estão liberadas, ou todas as liberadas quando p_empresas é nulo.
create or replace function public.app_filtra_empresas(p_empresas integer[])
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when app_todas_empresas_usuario(auth.uid()) then p_empresas
    when p_empresas is null then app_empresas_usuario(auth.uid())
    else array(select e from unnest(p_empresas) e where e = any(app_empresas_usuario(auth.uid())))
  end;
$$;

revoke all on function public.app_todas_empresas_usuario(uuid) from public, anon, authenticated;
revoke all on function public.app_empresas_usuario(uuid) from public, anon, authenticated;
grant execute on function public.app_todas_empresas_usuario(uuid) to service_role;
grant execute on function public.app_empresas_usuario(uuid) to service_role;
revoke all on function public.app_todas_empresas() from public, anon;
revoke all on function public.app_pode_empresa(integer) from public, anon;
revoke all on function public.app_filtra_empresas(integer[]) from public, anon;
grant execute on function public.app_todas_empresas() to authenticated;
grant execute on function public.app_pode_empresa(integer) to authenticated;
grant execute on function public.app_filtra_empresas(integer[]) to authenticated;

-- ---------- RLS das tabelas do app com empresa ----------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('app_saldo_contas_manual', 'financeiro.saldos'),
      ('app_rec_financeiro_lancamento', 'financeiro.lancamentos'),
      ('app_saldo_contas_selecionadas', 'financeiro.saldos'),
      ('app_fluxo_empresas_sem_receber', 'financeiro.fluxo')
    ) v(tabela, caminho)
  loop
    execute format('drop policy if exists %I on public.%I', t.tabela || '_select', t.tabela);
    execute format('create policy %I on public.%I for select to authenticated using (public.app_is_member() and public.app_pode_empresa(company_id))', t.tabela || '_select', t.tabela);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_insert', t.tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.app_pode(%L, true) and public.app_pode_empresa(company_id))', t.tabela || '_insert', t.tabela, t.caminho);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_update', t.tabela);
    execute format('create policy %I on public.%I for update to authenticated using (public.app_pode(%L, true) and public.app_pode_empresa(company_id)) with check (public.app_pode(%L, true) and public.app_pode_empresa(company_id))', t.tabela || '_update', t.tabela, t.caminho, t.caminho);
    execute format('drop policy if exists %I on public.%I', t.tabela || '_delete', t.tabela);
    execute format('create policy %I on public.%I for delete to authenticated using (public.app_pode(%L, true) and public.app_pode_empresa(company_id))', t.tabela || '_delete', t.tabela, t.caminho);
  end loop;
end;
$$;

-- Notas sem empresa identificada continuam visíveis para quem pode ver o histórico.
drop policy if exists app_nf_cadastros_select on public.app_nf_cadastros;
create policy app_nf_cadastros_select on public.app_nf_cadastros
  for select to authenticated
  using (public.app_is_member() and public.app_pode('notas.cadastros') and (empresa_id is null or public.app_pode_empresa(empresa_id)));

-- ---------- RPCs de leitura ----------
create or replace function public.app_empresas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
  with dp as (
    select (to_jsonb(d) ->> 'cd_empresa')::int as cd_empresa,
           string_agg(distinct nullif(trim(to_jsonb(d) ->> 'nome'), ''), ', ') as empreendimentos
    from de_para_sharepoint d
    where (to_jsonb(d) ->> 'cd_empresa') ~ '^\d+$'
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'nome', e.name,
           'nome_fantasia', nullif(trim(e.trade_name), ''),
           'cnpj', e.cnpj,
           'empreendimentos', dp.empreendimentos
         ) order by e.id), '[]'::jsonb)
    into result
  from empresas e
  left join dp on dp.cd_empresa = e.id
  where (v_emp is null or e.id = any(v_emp));
  return result;
end;
$$;

create or replace function public.app_centros_custo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.name, 'id_empresa', c.id_company) order by c.id), '[]'::jsonb)
    into result
  from centros_custo c
  where (v_emp is null or c.id_company = any(v_emp));
  return result;
end;
$$;

create or replace function public.app_contas_correntes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', c.company_id,
           'company_name', c.company_name,
           'bank_number', c.bank_number,
           'bank_name', c.bank_name,
           'agency_number', c.agency_number,
           'account_number', c.account_number,
           'account_name', c.account_name,
           'account_type', c.account_type_description
         ) order by c.company_id, c.bank_name, c.account_number), '[]'::jsonb)
    into result
  from contas_correntes c
  where c.account_status = 'ENABLED'
    and (v_emp is null or c.company_id = any(v_emp));
  return result;
end;
$$;

create or replace function public.app_fluxo_diario(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result jsonb;
  lock_antes text := current_setting('lock_timeout');
  -- %1$I tabela, %2$I saldo em aberto, %3$I valor original, %4$I saldo corrigido
  sql text := $q$
  with rec as (
    select r.company_id, r.due_date as dia,
           sum(r.%2$I) filter (where r.%2$I > 0) as receber_aberto,
           sum(r.%3$I) as receber_original,
           sum(coalesce(r.%3$I, 0) - greatest(coalesce(r.%2$I, 0), 0)
               + case when r.%2$I > 0 then coalesce(r.%4$I, r.%2$I) else 0 end) as receber_corrigido
    from %1$I r
    where r.due_date between $1 and $2
      and ($3 is null or r.company_id = any($3))
    group by 1, 2
  ),
  caixa as (
    select r.company_id, r.due_date + 2 as dia,
           sum(coalesce(r.%4$I, r.%2$I)) as receber_caixa
    from %1$I r
    left join payment_term_descriptions ptd on ptd.payment_term_id = r.payment_term_id
    where r.due_date between $1 - 2 and $2 - 2
      and r.%2$I > 0
      and ($3 is null or r.company_id = any($3))
      and coalesce(ptd.grupo_parcela, '') not in ('Bens', 'Permuta', 'Financiamento')
      and not exists (select 1 from app_fluxo_empresas_sem_receber s where s.company_id = r.company_id)
    group by 1, 2
  ),
  pag as (
    select p.company_id, p.due_date as dia,
           sum(greatest(p.balance_amount - coalesce(p.balance_amount * (coalesce(p.tax_amount, 0) + coalesce(p.discount_amount, 0)) / nullif(p.original_amount, 0), 0), 0))
             filter (where p.balance_amount > 0) as pagar_aberto,
           sum(p.original_amount) as pagar_original,
           sum(greatest(p.original_amount - coalesce(p.tax_amount, 0) - coalesce(p.discount_amount, 0), 0)) as pagar_liquido,
           sum(p.original_amount - coalesce(p.balance_amount, 0)) as pagar_quitado,
           sum(coalesce(p.discount_amount, 0)) as pagar_desconto,
           sum(greatest(coalesce(p.corrected_balance_amount, 0) - coalesce(p.balance_amount, 0), 0)) as pagar_correcao
    from parcelas_pagar_raw p
    where p.due_date between $1 and $2
      and p.forecast_document is distinct from 'S'
      and ($3 is null or p.company_id = any($3))
    group by 1, 2
  ),
  chaves as (
    select company_id, dia from rec
    union select company_id, dia from caixa
    union select company_id, dia from pag
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', k.company_id,
           'dia', k.dia,
           'receber_aberto', coalesce(rec.receber_aberto, 0),
           'receber_original', coalesce(rec.receber_original, 0),
           'receber_corrigido', coalesce(rec.receber_corrigido, 0),
           'receber_caixa', coalesce(caixa.receber_caixa, 0),
           'pagar_aberto', coalesce(pag.pagar_aberto, 0),
           'pagar_original', coalesce(pag.pagar_original, 0),
           'pagar_liquido', coalesce(pag.pagar_liquido, 0),
           'pagar_quitado', coalesce(pag.pagar_quitado, 0),
           'pagar_desconto', coalesce(pag.pagar_desconto, 0),
           'pagar_correcao', coalesce(pag.pagar_correcao, 0)
         )), '[]'::jsonb)
  from chaves k
  left join rec on rec.company_id = k.company_id and rec.dia = k.dia
  left join caixa on caixa.company_id = k.company_id and caixa.dia = k.dia
  left join pag on pag.company_id = k.company_id and pag.dia = k.dia
  $q$;
begin
  perform app_require_auth();
  p_empresas := app_filtra_empresas(p_empresas);
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;

  begin
    perform set_config('lock_timeout', '200ms', true);
    execute format(sql, 'mv_parcelas_receber', 'saldo_aberto', 'valor_original', 'saldo_aberto_corrigido') into result using p_de, p_ate, p_empresas;
  exception when lock_not_available then
    -- MV em REFRESH: lê a tabela de origem (mais lenta, sempre atual).
    execute format(sql, 'parcelas_receber', 'balance_amount', 'original_amount', 'corrected_balance_amount') into result using p_de, p_ate, p_empresas;
  end;
  perform set_config('lock_timeout', lock_antes, true);
  return result;
end;
$$;

create or replace function public.app_receber_periodo(p_de date, p_ate date, p_empresas int[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result jsonb;
  lock_antes text := current_setting('lock_timeout');
  -- %1$I tabela, %2$I saldo em aberto
  sql text := $q$
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', x.company_id,
           'receber_aberto', x.receber_aberto,
           'parcelas', x.parcelas
         )), '[]'::jsonb)
  from (
    select r.company_id,
           sum(r.%2$I) as receber_aberto,
           count(*) as parcelas
    from %1$I r
    left join payment_term_descriptions ptd on ptd.payment_term_id = r.payment_term_id
    where r.due_date between $1 and $2
      and r.%2$I > 0
      and ($3 is null or r.company_id = any($3))
      and coalesce(ptd.grupo_parcela, '') not in ('Bens', 'Permuta', 'Financiamento')
    group by 1
  ) x
  $q$;
begin
  perform app_require_auth();
  p_empresas := app_filtra_empresas(p_empresas);
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;

  begin
    perform set_config('lock_timeout', '200ms', true);
    execute format(sql, 'mv_parcelas_receber', 'saldo_aberto') into result using p_de, p_ate, p_empresas;
  exception when lock_not_available then
    execute format(sql, 'parcelas_receber', 'balance_amount') into result using p_de, p_ate, p_empresas;
  end;
  perform set_config('lock_timeout', lock_antes, true);
  return result;
end;
$$;

create or replace function public.app_pagar_periodo(p_de date, p_ate date, p_empresas integer[] default null)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
begin
  perform app_require_auth();
  p_empresas := app_filtra_empresas(p_empresas);
  if p_ate < p_de then
    raise exception 'periodo invalido';
  end if;
  if p_ate - p_de > 400 then
    raise exception 'periodo maximo de 400 dias';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'bill_id', p.bill_id,
           'installment_id', p.installment_id,
           'company_id', p.company_id,
           'company_name', p.company_name,
           'due_date', p.due_date,
           'creditor_name', p.creditor_name,
           'document_id', trim(p.document_identification_id),
           'document_number', p.document_number,
           'business_area', p.business_area_name,
           'balance', p.balance_amount,
           'liquido', greatest(p.balance_amount - coalesce(p.balance_amount * (coalesce(p.tax_amount, 0) + coalesce(p.discount_amount, 0)) / nullif(p.original_amount, 0), 0), 0),
           'authorized', p.authorization_status = 'S'
         ) order by p.company_id, p.due_date, p.balance_amount desc), '[]'::jsonb)
    into result
  from parcelas_pagar_raw p
  where p.balance_amount > 0
    and p.forecast_document is distinct from 'S'
    and p.due_date between p_de and p_ate
    and (p_empresas is null or p.company_id = any(p_empresas));
  return result;
end;
$function$;

create or replace function public.app_pagar_segmentos(p_de date, p_ate date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
  if p_ate < p_de or p_ate - p_de > 400 then
    raise exception 'periodo invalido';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'company_id', t.company_id,
           'segmento', t.segmento,
           'total', t.total
         )), '[]'::jsonb)
    into result
  from (
    select p.company_id, coalesce(nullif(trim(p.business_area_name), ''), 'Sem segmento') as segmento,
           sum(greatest(p.original_amount - coalesce(p.tax_amount, 0) - coalesce(p.discount_amount, 0), 0)) as total
    from parcelas_pagar_raw p
    where p.due_date between p_de and p_ate
      and p.forecast_document is distinct from 'S'
      and (v_emp is null or p.company_id = any(v_emp))
    group by 1, 2
  ) t;
  return result;
end;
$function$;

create or replace function public.app_pagos_diario(p_de date, p_ate date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
  v_emp integer[];
begin
  perform app_require_auth();
  v_emp := app_filtra_empresas(null);
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
      select x.company_id from parcelas_pagar_raw x
      where x.chave_parcela = p.chave_parcela and x.forecast_document is distinct from 'S'
      limit 1
    ) r on true
    where p.operation_type_name = 'Pagamento'
      and p.payment_date between p_de and p_ate
      and (v_emp is null or r.company_id = any(v_emp))
    group by 1, 2
  ) t;
  return result;
end;
$function$;
