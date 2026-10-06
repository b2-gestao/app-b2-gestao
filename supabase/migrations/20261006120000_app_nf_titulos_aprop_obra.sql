-- Notas Fiscais › Título a Pagar: apropriação de obra do título (buildingsCost do POST /v1/bills)
-- gravada no histórico ao lado da apropriação financeira.

alter table public.app_nf_titulos
  -- [{ buildingId, buildingUnitId, costEstimationSheetId, percentage }]
  add column if not exists apropriacoes_obra jsonb not null default '[]'::jsonb;
