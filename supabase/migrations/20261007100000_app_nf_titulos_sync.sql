-- Notas Fiscais › Título a Pagar: sincronização com o Sienge.
--
-- A lista lê app_nf_titulos, gravada no momento do cadastro. Quando o título é excluído no Sienge,
-- a linha continuava aparecendo. A ação "sincronizar" da edge function app-nf (já disparada pelo
-- pg_cron a cada 15 min, ver 20261005200000 e 20261006110000) passa a conferir também cada título
-- (GET /v1/bills/{billId}) e marca excluida_no_sienge_em quando ele não existe mais; a tela oculta
-- essas linhas e o registro fica no banco para auditoria.

alter table public.app_nf_titulos
  add column if not exists excluida_no_sienge_em timestamptz,
  add column if not exists verificada_em timestamptz;

-- Linhas a verificar: as com número de título e não excluídas, das menos recentemente conferidas.
create index if not exists app_nf_titulos_sync_idx
  on public.app_nf_titulos (verificada_em nulls first)
  where excluida_no_sienge_em is null and bill_id is not null;
