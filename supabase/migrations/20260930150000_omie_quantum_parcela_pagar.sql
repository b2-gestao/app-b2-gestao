-- Renomeia omie_titulos_pagar -> omie_quantum_parcela_pagar (nome pedido para a base).
-- As funções da carga (n8n) mantêm o nome; só o corpo passa a apontar para as tabelas novas.

alter table public.omie_titulos_pagar rename to omie_quantum_parcela_pagar;
alter table public.omie_titulos_pagar_staging rename to omie_quantum_parcela_pagar_staging;

alter table public.omie_quantum_parcela_pagar
  rename constraint omie_titulos_pagar_pkey to omie_quantum_parcela_pagar_pkey;
alter table public.omie_quantum_parcela_pagar_staging
  rename constraint omie_titulos_pagar_staging_pkey to omie_quantum_parcela_pagar_staging_pkey;

alter index public.omie_titulos_pagar_venc_idx rename to omie_quantum_parcela_pagar_venc_idx;
alter index public.omie_titulos_pagar_titulo_idx rename to omie_quantum_parcela_pagar_titulo_idx;

create or replace function public.omie_titulos_pagar_staging_limpar(p_empresa text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.omie_quantum_parcela_pagar_staging where empresa = p_empresa;
$$;

create or replace function public.omie_titulos_pagar_staging_inserir(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.omie_quantum_parcela_pagar_staging
  select * from jsonb_populate_recordset(null::public.omie_quantum_parcela_pagar_staging, payload)
  on conflict (empresa, id_movimento) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Recusa a troca se a staging tiver menos da metade dos títulos atuais
-- (resposta vazia/parcial da Omie não apaga a tabela).
create or replace function public.omie_titulos_pagar_swap(p_empresa text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n_atual   integer;
  n_staging integer;
begin
  select count(*) into n_atual from public.omie_quantum_parcela_pagar where empresa = p_empresa;
  select count(*) into n_staging from public.omie_quantum_parcela_pagar_staging where empresa = p_empresa;

  if n_staging = 0 or n_staging < n_atual / 2 then
    raise exception 'omie_titulos_pagar_swap(%): staging com % títulos, final com % — troca cancelada',
      p_empresa, n_staging, n_atual;
  end if;

  delete from public.omie_quantum_parcela_pagar where empresa = p_empresa;

  insert into public.omie_quantum_parcela_pagar
  select * from public.omie_quantum_parcela_pagar_staging where empresa = p_empresa;

  delete from public.omie_quantum_parcela_pagar_staging where empresa = p_empresa;

  return n_staging;
end;
$$;
