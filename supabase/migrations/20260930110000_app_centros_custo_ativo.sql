-- Centros de custo: situação (ativo/inativo) para o seletor do cadastro de usuário.
--
-- O Sienge não informa situação de centro de custo (/v1/cost-centers só traz id, name,
-- idCompany e cnpj). A marcação é feita no nome: "(DESATIVADO)", "(DESATIVAR)", "INATIVO",
-- "INATIVADA", "ENCERRADO COM PENDÊNCIAS FINANCEIRAS". Esses ficam com ativo = false.
--
-- app_centros_custo continua devolvendo todos (a tela de notas mostra o nome de centros já
-- usados); o app filtra os inativos só onde se escolhe um centro novo.

create or replace function public.app_centro_custo_ativo(p_nome text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_nome, '') !~* '(desativ|inativ|encerrad)';
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'nome', c.name,
           'id_empresa', c.id_company,
           'ativo', app_centro_custo_ativo(c.name)
         ) order by c.id), '[]'::jsonb)
    into result
  from centros_custo c
  where (v_emp is null or c.id_company = any(v_emp));
  return result;
end;
$$;
