-- ListarMovimentos devolve movimentos, não títulos: cada título vem uma vez como CONTA_A_PAGAR
-- e de novo em cada baixa (CONTA_CORRENTE_PAG); tarifas e lançamentos de conta corrente vêm com
-- nCodTitulo = 0. A PK (empresa, n_cod_titulo) derrubava as baixas; o ETL do Power Query mantém
-- todas as linhas. Chave nova por movimento: cGrupo|nCodTitulo|nCodBaixa|nCodMovCC.
--
-- As tabelas só têm a carga de teste; o n8n recarrega tudo na próxima execução.

truncate public.omie_titulos_pagar, public.omie_titulos_pagar_staging;

do $$
declare
  t text;
begin
  -- mesma ordem de colunas nas duas tabelas (o swap faz insert … select *)
  foreach t in array array['omie_titulos_pagar', 'omie_titulos_pagar_staging'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_pkey');
    execute format($f$
      alter table public.%I
        add column id_movimento   text not null,
        add column c_grupo        text,
        add column c_origem       text,
        add column n_cod_baixa    bigint,
        add column n_cod_mov_cc   bigint,
        add column n_valor_mov_cc numeric(15, 2),
        add column d_dt_credito   date
    $f$, t);
    execute format('alter table public.%I add primary key (empresa, id_movimento)', t);
  end loop;
end $$;

create index omie_titulos_pagar_titulo_idx on public.omie_titulos_pagar (empresa, n_cod_titulo);

create or replace function public.omie_titulos_pagar_staging_inserir(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.omie_titulos_pagar_staging
  select * from jsonb_populate_recordset(null::public.omie_titulos_pagar_staging, payload)
  on conflict (empresa, id_movimento) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
