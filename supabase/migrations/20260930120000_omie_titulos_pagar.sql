-- Títulos a pagar da Omie (hoje só QUANTUM), carregados pelo n8n
-- ("Omie - Sync Títulos a Pagar (QUANTUM) -> Supabase") todo dia às 06:00.
--
-- Carga total diária em staging + swap: se a execução quebrar no meio, a tabela final
-- fica com os dados do dia anterior; título excluído na Omie some na carga seguinte.
-- Categoria (ListarCategorias) e credor (ListarClientesResumido) são mesclados no n8n
-- e só as colunas abaixo chegam aqui — aquelas tabelas não são gravadas no Supabase.
--
-- Acesso: sem grants para anon/authenticated (padrão de 20260923190100_fechar_tabelas_anon);
-- o n8n usa service_role.

create table public.omie_titulos_pagar (
  empresa               text        not null,
  n_cod_titulo          bigint      not null,
  c_num_titulo          text,
  c_num_parcela         text,
  c_status              text,
  c_num_doc_fiscal      text,
  d_dt_emissao          date,
  d_dt_venc             date,
  d_dt_previsao         date,
  d_dt_pagamento        date,
  d_dt_inc              date,
  d_dt_alt              date,
  n_valor_titulo        numeric(15, 2),
  resumo_n_val_pago     numeric(15, 2),
  resumo_n_val_aberto   numeric(15, 2),
  resumo_n_val_liquido  numeric(15, 2),
  resumo_n_desconto     numeric(15, 2),
  resumo_n_juros        numeric(15, 2),
  resumo_n_multa        numeric(15, 2),
  c_cod_categ           text,
  categoria_descricao   text,
  n_cod_cliente         bigint,
  c_cpf_cnpj_cliente    text,
  credor_razao_social   text,
  credor_nome_fantasia  text,
  credor_cnpj_cpf       text,
  n_cod_cc              bigint,
  categorias_json       jsonb,
  departamentos_json    jsonb,
  dados                 jsonb       not null,  -- registro completo da API (detalhes + resumo_*)
  sincronizado_em       timestamptz not null default now(),
  primary key (empresa, n_cod_titulo)
);

create index omie_titulos_pagar_venc_idx on public.omie_titulos_pagar (empresa, d_dt_venc);

create table public.omie_titulos_pagar_staging (like public.omie_titulos_pagar including all);

revoke all on table public.omie_titulos_pagar, public.omie_titulos_pagar_staging from anon, authenticated;

create function public.omie_titulos_pagar_staging_limpar(p_empresa text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.omie_titulos_pagar_staging where empresa = p_empresa;
$$;

create function public.omie_titulos_pagar_staging_inserir(payload jsonb)
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
  on conflict (empresa, n_cod_titulo) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Troca a empresa inteira da final pela staging. Recusa a troca se a staging tiver
-- menos da metade dos títulos atuais (resposta vazia/parcial da Omie não apaga a tabela).
create function public.omie_titulos_pagar_swap(p_empresa text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n_atual   integer;
  n_staging integer;
begin
  select count(*) into n_atual from public.omie_titulos_pagar where empresa = p_empresa;
  select count(*) into n_staging from public.omie_titulos_pagar_staging where empresa = p_empresa;

  if n_staging = 0 or n_staging < n_atual / 2 then
    raise exception 'omie_titulos_pagar_swap(%): staging com % títulos, final com % — troca cancelada',
      p_empresa, n_staging, n_atual;
  end if;

  delete from public.omie_titulos_pagar where empresa = p_empresa;

  insert into public.omie_titulos_pagar
  select * from public.omie_titulos_pagar_staging where empresa = p_empresa;

  delete from public.omie_titulos_pagar_staging where empresa = p_empresa;

  return n_staging;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.omie_titulos_pagar_staging_limpar(text)',
    'public.omie_titulos_pagar_staging_inserir(jsonb)',
    'public.omie_titulos_pagar_swap(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
