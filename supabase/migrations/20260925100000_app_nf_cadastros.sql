-- Notas Fiscais › Cadastros: histórico das notas de compra cadastradas no Sienge pelo app.
--
-- Quem grava é só a edge function app-nf (service_role), depois que o Sienge confirma a nota:
-- o navegador não insere nem altera linhas, então o histórico não pode ser forjado pela tela.
-- Leitura: quem tem notas.cadastros (ver) no perfil. O perfil de sistema (Administrador) vê tudo.
--
-- situacao:
--   cadastrada ........... nota criada e insumos do pedido vinculados (título pode ter avisos)
--   itens_nao_vinculados . nota criada no Sienge, mas o vínculo dos insumos falhou: ajuste manual

create table if not exists public.app_nf_cadastros (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  criado_por_email text,
  situacao text not null default 'cadastrada' check (situacao in ('cadastrada', 'itens_nao_vinculados')),
  tipo_documento text not null check (tipo_documento in ('NFE', 'NFSE', 'BOLETO', 'FATURA')),
  numero text not null,
  serie text,
  data_emissao date,
  data_movimento date,
  vencimento date,
  valor numeric(18, 2),
  fornecedor_id integer,
  fornecedor_nome text,
  empresa_id integer,
  empresa_nome text,
  pedido text not null,
  obra_nome text,
  sequencial integer not null,
  bill_id integer,
  -- [{ itemNumber, quantidade }] vinculados ao pedido
  itens jsonb not null default '[]'::jsonb,
  -- Pendências para ajuste manual devolvidas pela gravação (vencimento, anexo, título).
  avisos text[] not null default array[]::text[],
  -- [{ descricao, nome, ok, erro? }]: PDF do cadastro e anexos adicionais enviados ao título.
  anexos jsonb not null default '[]'::jsonb
);

create index if not exists app_nf_cadastros_criado_em_idx on public.app_nf_cadastros (criado_em desc);

alter table public.app_nf_cadastros enable row level security;

drop policy if exists app_nf_cadastros_select on public.app_nf_cadastros;
create policy app_nf_cadastros_select on public.app_nf_cadastros
  for select to authenticated using (public.app_is_member() and public.app_pode('notas.cadastros'));

revoke all on table public.app_nf_cadastros from anon, authenticated;
grant select on table public.app_nf_cadastros to authenticated;
