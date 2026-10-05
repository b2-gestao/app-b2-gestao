-- Notas Fiscais › Cadastros: documentos do Sienge (NFE, NFSE, NFPJ, BOL, FAT...) para o seletor
-- "Tipo de documento" da conferência.
--
-- A API do Sienge só busca um documento por código (GET /v1/document-identifications/{id},
-- que devolve id e nome); não há listagem. A lista sai dos documentos já usados nos títulos
-- a pagar sincronizados (parcelas_pagar_raw), e a edge function app-nf confere o código
-- escolhido nessa API antes de gravar a nota.

create or replace function public.app_nf_documentos()
returns table (id text, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select trim(p.document_identification_id) as id,
         max(trim(p.document_identification_name)) as nome
  from parcelas_pagar_raw p
  where trim(coalesce(p.document_identification_id, '')) <> ''
  group by trim(p.document_identification_id)
  order by 1;
$$;

revoke all on function public.app_nf_documentos() from public, anon;
grant execute on function public.app_nf_documentos() to authenticated, service_role;

-- Código do documento no Sienge usado na gravação (o tipo_documento segue sendo a classificação
-- do app: NFE, NFSE, BOLETO ou FATURA). Linhas antigas ficam nulas.
alter table public.app_nf_cadastros add column if not exists documento_sienge text;
