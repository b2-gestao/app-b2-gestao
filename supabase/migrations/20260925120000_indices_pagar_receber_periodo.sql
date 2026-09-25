-- Índices por período para as RPCs do Fluxo e da Programação.
--
-- EXPLAIN ANALYZE de 25/09 (90 dias):
--   parcelas_pagar_raw, sem índice por data: seq scan de 255 mil linhas / 134 MB para devolver
--   2,6 mil (0,8 s frio). Afeta app_pagar_periodo, app_pagar_segmentos e app_fluxo_diario.
--   mv_parcelas_receber via ix_mv_pr_due_date: 1.614 blocos lidos do heap (1,5 s frio).
--
-- A carga do pagar recria parcelas_pagar_raw_staging a cada swap só com o índice de
-- chave_parcela, então o índice novo também entra em swap_parcelas_pagar_raw(); o resto da
-- função fica idêntico ao que está em produção.

create index if not exists ix_ppr_due_company on public.parcelas_pagar_raw (due_date, company_id);
create index if not exists ix_ppr_staging_due_company on public.parcelas_pagar_raw_staging (due_date, company_id);

create index if not exists ix_mv_pr_due_cobertura on public.mv_parcelas_receber (due_date)
  include (company_id, saldo_aberto, valor_original);

CREATE OR REPLACE FUNCTION public.swap_parcelas_pagar_raw()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    alter table parcelas_pagar_raw rename to parcelas_pagar_raw_old;
    alter table parcelas_pagar_raw_staging rename to parcelas_pagar_raw;
    alter table parcelas_pagar_raw set logged;
    create unlogged table parcelas_pagar_raw_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        company_id integer,
        company_name text,
        project_id integer,
        project_name text,
        business_area_id integer,
        business_area_name text,
        business_type_id integer,
        business_type_name text,
        group_company_id integer,
        group_company_name text,
        holding_id integer,
        holding_name text,
        subsidiary_id integer,
        subsidiary_name text,
        creditor_id integer,
        creditor_name text,
        document_number text,
        document_identification_id text,
        document_identification_name text,
        origin_id text,
        original_amount numeric,
        discount_amount numeric,
        tax_amount numeric,
        balance_amount numeric,
        corrected_balance_amount numeric,
        indexer_id integer,
        indexer_name text,
        bill_date date,
        issue_date date,
        installment_base_date date,
        registered_date timestamptz,
        registered_by text,
        registered_user_id text,
        forecast_document text,
        consistency_status text,
        authorization_status text,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_raw_staging (chave_parcela);
    create index on parcelas_pagar_raw_staging (due_date, company_id);
    drop table parcelas_pagar_raw_old;

    alter table parcelas_pagar_authorizations rename to parcelas_pagar_authorizations_old;
    alter table parcelas_pagar_authorizations_staging rename to parcelas_pagar_authorizations;
    alter table parcelas_pagar_authorizations set logged;
    create unlogged table parcelas_pagar_authorizations_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_authorizations_staging (chave_parcela);
    drop table parcelas_pagar_authorizations_old;

    alter table parcelas_pagar_buildings_costs rename to parcelas_pagar_buildings_costs_old;
    alter table parcelas_pagar_buildings_costs_staging rename to parcelas_pagar_buildings_costs;
    alter table parcelas_pagar_buildings_costs set logged;
    create unlogged table parcelas_pagar_buildings_costs_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        building_id integer,
        building_name text,
        building_unit_id integer,
        building_unit_name text,
        cost_estimation_sheet_id text,
        cost_estimation_sheet_name text,
        rate numeric,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_buildings_costs_staging (chave_parcela);
    drop table parcelas_pagar_buildings_costs_old;

    alter table parcelas_pagar_payments_categories rename to parcelas_pagar_payments_categories_old;
    alter table parcelas_pagar_payments_categories_staging rename to parcelas_pagar_payments_categories;
    alter table parcelas_pagar_payments_categories set logged;
    create unlogged table parcelas_pagar_payments_categories_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        project_id integer,
        project_name text,
        cost_center_id integer,
        cost_center_name text,
        financial_category_id text,
        financial_category_name text,
        financial_category_rate numeric,
        financial_category_type text,
        financial_category_reducer text,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_payments_categories_staging (chave_parcela);
    drop table parcelas_pagar_payments_categories_old;

    alter table parcelas_pagar_payments rename to parcelas_pagar_payments_old;
    alter table parcelas_pagar_payments_staging rename to parcelas_pagar_payments;
    alter table parcelas_pagar_payments set logged;
    create unlogged table parcelas_pagar_payments_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        payment_sequencial_number integer,
        operation_type_id integer,
        operation_type_name text,
        gross_amount numeric,
        net_amount numeric,
        discount_amount numeric,
        tax_amount numeric,
        fine_amount numeric,
        interest_amount numeric,
        monetary_correction_amount numeric,
        corrected_net_amount numeric,
        calculation_date date,
        payment_date date,
        payment_authentication text,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_payments_staging (chave_parcela);
    drop table parcelas_pagar_payments_old;

    alter table parcelas_pagar_departments_costs rename to parcelas_pagar_departments_costs_old;
    alter table parcelas_pagar_departments_costs_staging rename to parcelas_pagar_departments_costs;
    alter table parcelas_pagar_departments_costs set logged;
    create unlogged table parcelas_pagar_departments_costs_staging (
        id bigserial primary key,
        bill_id integer,
        installment_id integer,
        due_date date,
        chave_parcela text generated always as
            (bill_id::text || '|' || installment_id::text || '|' || coalesce(lpad(extract(year from due_date)::text, 4, '0') || '-' || lpad(extract(month from due_date)::text, 2, '0') || '-' || lpad(extract(day from due_date)::text, 2, '0'), '')) stored,
        department_id integer,
        department_name text,
        rate numeric,
        extra jsonb,
        fetched_at timestamptz default now()
    );
    create index on parcelas_pagar_departments_costs_staging (chave_parcela);
    drop table parcelas_pagar_departments_costs_old;
end;
$function$;
