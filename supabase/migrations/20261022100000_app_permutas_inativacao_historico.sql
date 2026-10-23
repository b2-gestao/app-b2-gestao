-- Permutas › Terrenos › Cadastros: cidade, inscrições (IPTU, Equatorial, Saneago/BRK), inativação do
-- cadastro e de unidades (com motivo) e histórico de alterações.
--
--   app_permutas            + cidade, inscricao_iptu, inscricao_equatorial, inscricao_saneago,
--                             ativo, motivo_inativacao (motivo da inativação vigente).
--   app_permuta_unidades    + ativo, motivo_inativacao.
--   app_permutas_historico  Uma linha por alteração no cadastro ou nas unidades, gravada só por trigger
--                           (quem = auth.uid(); alteracoes = só os campos que mudaram, {campo: {de, para}}).
--   Negócio: só empresas do Sienge. negocios_permuta fica só para os cadastros antigos (sem novos negócios).
--
-- Inativar/reativar só pelas funções app_permuta_status / app_permuta_unidade_status, que exigem motivo
-- (5 a 500 caracteres). Cadastro inativo (e suas unidades) fica só para leitura até ser reativado.
-- O motivo chega às triggers pela configuração local da transação app.permutas_motivo.

-- ---------- colunas ----------
alter table public.app_permutas
  add column if not exists cidade text,
  add column if not exists inscricao_iptu text,
  add column if not exists inscricao_equatorial text,
  add column if not exists inscricao_saneago text,
  add column if not exists ativo boolean not null default true,
  add column if not exists motivo_inativacao text;

alter table public.app_permuta_unidades
  add column if not exists ativo boolean not null default true,
  add column if not exists motivo_inativacao text;

create index if not exists app_permutas_ativo_idx on public.app_permutas (ativo);

-- ---------- histórico ----------
create table if not exists public.app_permutas_historico (
  id bigint generated always as identity primary key,
  permuta_id uuid not null references public.app_permutas (id) on delete cascade,
  acao text not null check (acao in (
    'criado', 'editado', 'inativado', 'reativado',
    'unidade_incluida', 'unidade_editada', 'unidade_removida', 'unidade_inativada', 'unidade_reativada')),
  -- unidade afetada (nas ações de unidade): empreendimento do Sienge e nome da unidade
  enterprise_id integer,
  unidade text,
  alteracoes jsonb,
  motivo text,
  usuario uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists app_permutas_historico_permuta_idx on public.app_permutas_historico (permuta_id, criado_em desc);

alter table public.app_permutas_historico enable row level security;
drop policy if exists app_permutas_historico_select on public.app_permutas_historico;
create policy app_permutas_historico_select on public.app_permutas_historico for select to authenticated
  using (public.app_is_member() and public.app_permutas_pode());
-- Sem insert/update/delete para o app: só as triggers (security definer) gravam.
revoke all on table public.app_permutas_historico from anon, authenticated;
grant select on table public.app_permutas_historico to authenticated;

-- ---------- negócio: só empresas do Sienge ----------
-- Não se criam nem renomeiam negócios avulsos; os existentes continuam valendo para os cadastros antigos.
drop policy if exists negocios_permuta_insert on public.negocios_permuta;
drop policy if exists negocios_permuta_update on public.negocios_permuta;
revoke insert, update on table public.negocios_permuta from authenticated;

-- Normaliza textos, bloqueia edição de cadastro inativo e valida a origem: empresa existente no Sienge; negócio avulso só se já estava gravado.
create or replace function public.app_permutas_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cadastro inativo é só leitura: a única mudança aceita é a reativação.
  if tg_op = 'UPDATE' and not old.ativo and not new.ativo then
    raise exception 'Cadastro inativo: reative para editar.' using errcode = '55000';
  end if;
  new.cidade := nullif(btrim(new.cidade), '');
  new.inscricao_iptu := nullif(btrim(new.inscricao_iptu), '');
  new.inscricao_equatorial := nullif(btrim(new.inscricao_equatorial), '');
  new.inscricao_saneago := nullif(btrim(new.inscricao_saneago), '');
  if new.negocio_id is not null and (tg_op = 'INSERT' or new.negocio_id is distinct from old.negocio_id) then
    raise exception 'Selecione uma empresa do Sienge como negócio.' using errcode = '23514';
  end if;
  if new.empresa_id is not null and (tg_op = 'INSERT' or new.empresa_id is distinct from old.empresa_id)
     and not exists (select 1 from empresas e where e.id = new.empresa_id) then
    raise exception 'Empresa % não encontrada no Sienge.', new.empresa_id using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.app_permutas_valida() from public, anon, authenticated;

drop trigger if exists app_permutas_valida on public.app_permutas;
create trigger app_permutas_valida before insert or update on public.app_permutas
  for each row execute function public.app_permutas_valida();

-- Unidades de cadastro inativo também ficam só para leitura (na exclusão em cascata a permuta já saiu).
create or replace function public.app_permuta_unidades_ck()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from app_permutas p
             where p.id in (new.permuta_id, old.permuta_id) and not p.ativo) then
    raise exception 'Cadastro inativo: reative para alterar as unidades.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.app_permuta_unidades_ck() from public, anon, authenticated;

drop trigger if exists app_permuta_unidades_ck on public.app_permuta_unidades;
create trigger app_permuta_unidades_ck before insert or update or delete on public.app_permuta_unidades
  for each row execute function public.app_permuta_unidades_ck();

-- ---------- status (cadastro e unidades) ----------
-- Mudar "ativo" exige o motivo da transação; motivo_inativacao só muda junto com o status.
create or replace function public.app_permutas_status_ck()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_motivo text := btrim(coalesce(current_setting('app.permutas_motivo', true), ''));
begin
  if (tg_op = 'INSERT' and not new.ativo) or (tg_op = 'UPDATE' and new.ativo is distinct from old.ativo) then
    if length(v_motivo) < 5 then
      raise exception 'Informe o motivo (mínimo de 5 caracteres).' using errcode = '22023';
    end if;
    new.motivo_inativacao := case when new.ativo then null else v_motivo end;
  elsif tg_op = 'UPDATE' then
    new.motivo_inativacao := old.motivo_inativacao;
  else
    new.motivo_inativacao := null;
  end if;
  return new;
end;
$$;
revoke all on function public.app_permutas_status_ck() from public, anon, authenticated;

drop trigger if exists app_permutas_status on public.app_permutas;
create trigger app_permutas_status before insert or update on public.app_permutas
  for each row execute function public.app_permutas_status_ck();
drop trigger if exists app_permuta_unidades_status on public.app_permuta_unidades;
create trigger app_permuta_unidades_status before insert or update on public.app_permuta_unidades
  for each row execute function public.app_permutas_status_ck();

-- ---------- gravação do histórico ----------
-- Campos que não entram no "antes → depois" (técnicos ou tratados pela ação/motivo).
create or replace function public.app_permutas_historico_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_velho jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_reg jsonb := coalesce(v_novo, v_velho);
  v_unidade boolean := tg_table_name = 'app_permuta_unidades';
  v_pid uuid := (case when v_unidade then v_reg ->> 'permuta_id' else v_reg ->> 'id' end)::uuid;
  v_ignorar text[] := array['id', 'permuta_id', 'unidade_id', 'ordem', 'ativo', 'motivo_inativacao',
                            'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por'];
  v_motivo text := nullif(btrim(coalesce(current_setting('app.permutas_motivo', true), '')), '');
  v_alt jsonb;
  v_acao text;
begin
  -- Exclusão em cascata da permuta: o histórico vai junto, nada a registrar.
  if tg_op = 'DELETE' and not exists (select 1 from app_permutas p where p.id = v_pid) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('de', v_velho -> k, 'para', v_novo -> k))
      into v_alt
    from jsonb_object_keys(v_novo) k
    where k <> all (v_ignorar) and (v_novo -> k) is distinct from (v_velho -> k);
    if (v_novo -> 'ativo') is distinct from (v_velho -> 'ativo') then
      v_acao := case when (v_novo ->> 'ativo')::boolean then 'reativado' else 'inativado' end;
    elsif v_alt is null then
      return null; -- nada mudou de fato
    else
      v_acao := 'editado';
      v_motivo := null;
    end if;
  else
    v_acao := case when tg_op = 'INSERT' then 'criado' else 'removido' end;
    v_motivo := null;
  end if;
  -- Nas unidades a ação leva o prefixo e o feminino (unidade_incluida, unidade_inativada…).
  if v_unidade then
    v_acao := 'unidade_' || case v_acao when 'criado' then 'incluida' when 'removido' then 'removida' when 'editado' then 'editada'
                                        when 'inativado' then 'inativada' else 'reativada' end;
  end if;

  insert into app_permutas_historico (permuta_id, acao, enterprise_id, unidade, alteracoes, motivo, usuario)
  values (
    v_pid,
    v_acao,
    case when v_unidade then (v_reg ->> 'enterprise_id')::integer end,
    case when v_unidade then v_reg ->> 'unidade_nome' end,
    v_alt, v_motivo, auth.uid()
  );
  return null;
end;
$$;
revoke all on function public.app_permutas_historico_log() from public, anon, authenticated;

drop trigger if exists app_permutas_historico on public.app_permutas;
create trigger app_permutas_historico after insert or update on public.app_permutas
  for each row execute function public.app_permutas_historico_log();
drop trigger if exists app_permuta_unidades_historico on public.app_permuta_unidades;
create trigger app_permuta_unidades_historico after insert or update or delete on public.app_permuta_unidades
  for each row execute function public.app_permutas_historico_log();

-- ---------- inativar / reativar ----------
create or replace function public.app_permuta_status(p_id uuid, p_ativo boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform app_require_auth();
  if not app_permutas_pode(true) then
    raise exception 'Sem permissão para alterar permutas.' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'Informe se é para inativar ou reativar.' using errcode = '22004';
  end if;
  if length(v_motivo) not between 5 and 500 then
    raise exception 'Informe o motivo (de 5 a 500 caracteres).' using errcode = '22023';
  end if;
  perform set_config('app.permutas_motivo', v_motivo, true);
  update app_permutas set ativo = p_ativo where id = p_id and ativo is distinct from p_ativo;
  if not found then
    raise exception 'Cadastro não encontrado ou já está nesse status.' using errcode = 'P0002';
  end if;
  perform set_config('app.permutas_motivo', '', true);
end;
$$;
revoke all on function public.app_permuta_status(uuid, boolean, text) from public, anon;
grant execute on function public.app_permuta_status(uuid, boolean, text) to authenticated;

create or replace function public.app_permuta_unidade_status(p_id uuid, p_ativo boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform app_require_auth();
  if not app_permutas_pode(true) then
    raise exception 'Sem permissão para alterar permutas.' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'Informe se é para inativar ou reativar.' using errcode = '22004';
  end if;
  if length(v_motivo) not between 5 and 500 then
    raise exception 'Informe o motivo (de 5 a 500 caracteres).' using errcode = '22023';
  end if;
  perform set_config('app.permutas_motivo', v_motivo, true);
  update app_permuta_unidades set ativo = p_ativo where id = p_id and ativo is distinct from p_ativo;
  if not found then
    raise exception 'Unidade não encontrada ou já está nesse status.' using errcode = 'P0002';
  end if;
  perform set_config('app.permutas_motivo', '', true);
end;
$$;
revoke all on function public.app_permuta_unidade_status(uuid, boolean, text) from public, anon;
grant execute on function public.app_permuta_unidade_status(uuid, boolean, text) to authenticated;

-- ---------- leitura do histórico ----------
-- Mais recente primeiro, com o nome de quem alterou (app_usuarios; na falta, o e-mail).
create or replace function public.app_permutas_historico(p_permuta uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform app_require_auth();
  if not app_permutas_pode() then
    raise exception 'Sem permissão para Permutas.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', h.id, 'acao', h.acao, 'enterprise_id', h.enterprise_id, 'unidade', h.unidade,
             'alteracoes', h.alteracoes, 'motivo', h.motivo, 'criado_em', h.criado_em,
             'usuario', coalesce(nullif(btrim(u.nome), ''), au.email::text)
           ) order by h.criado_em desc, h.id desc)
    from app_permutas_historico h
    left join app_usuarios u on u.id = h.usuario
    left join auth.users au on au.id = h.usuario
    where h.permuta_id = p_permuta
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.app_permutas_historico(uuid) from public, anon;
grant execute on function public.app_permutas_historico(uuid) to authenticated;
