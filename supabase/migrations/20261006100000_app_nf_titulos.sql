-- Notas Fiscais › Título a Pagar: histórico dos títulos do contas a pagar cadastrados no Sienge
-- pelo app (POST /v1/bills), sem pedido de compra nem nota fiscal de compra.
--
-- Quem grava é só a edge function app-nf (service_role), depois que o Sienge confirma o título:
-- o navegador não insere nem altera linhas, então o histórico não pode ser forjado pela tela.
-- Leitura: quem tem notas.titulos (ver) no perfil e acesso à empresa do título.

create table if not exists public.app_nf_titulos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  criado_por_email text,
  -- Classificação do app (NFE, NFSE, BOLETO, FATURA); documento_sienge é o código gravado no título.
  tipo_documento text not null check (tipo_documento in ('NFE', 'NFSE', 'BOLETO', 'FATURA')),
  documento_sienge text,
  numero text not null,
  data_emissao date,
  data_competencia date,
  vencimento date,
  parcelas integer not null default 1 check (parcelas >= 1),
  valor numeric(18, 2),
  desconto numeric(18, 2) not null default 0,
  fornecedor_id integer,
  fornecedor_nome text,
  empresa_id integer,
  empresa_nome text,
  -- Número do título no Sienge (nulo quando o Sienge não informou: ajuste manual).
  bill_id integer,
  -- [{ costCenterId, paymentCategoriesId, percentage }]
  apropriacoes jsonb not null default '[]'::jsonb,
  -- Pendências para ajuste manual devolvidas pela gravação (número do título, anexo).
  avisos text[] not null default array[]::text[],
  -- [{ descricao, nome, ok, erro? }]: PDF do cadastro e anexos adicionais enviados ao título.
  anexos jsonb not null default '[]'::jsonb
);

create index if not exists app_nf_titulos_criado_em_idx on public.app_nf_titulos (criado_em desc);

alter table public.app_nf_titulos enable row level security;

drop policy if exists app_nf_titulos_select on public.app_nf_titulos;
create policy app_nf_titulos_select on public.app_nf_titulos
  for select to authenticated
  using (public.app_is_member() and public.app_pode('notas.titulos') and (empresa_id is null or public.app_pode_empresa(empresa_id)));

revoke all on table public.app_nf_titulos from anon, authenticated;
grant select on table public.app_nf_titulos to authenticated;

-- Planos financeiros para o seletor da apropriação. A API do Sienge só busca um plano por código
-- (GET /v1/payment-categories/{id}); a lista sai dos planos já usados nos títulos a pagar
-- sincronizados, e a edge function confere cada código no Sienge antes de gravar.
create or replace function public.app_planos_financeiros()
returns table (id text, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select trim(c.financial_category_id) as id,
         max(trim(c.financial_category_name)) as nome
  from parcelas_pagar_payments_categories c
  where trim(coalesce(c.financial_category_id, '')) <> ''
  group by trim(c.financial_category_id)
  order by 1;
$$;

revoke all on function public.app_planos_financeiros() from public, anon;
grant execute on function public.app_planos_financeiros() to authenticated, service_role;
