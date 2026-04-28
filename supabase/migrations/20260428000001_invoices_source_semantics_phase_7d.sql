-- Phase 7D: evolve invoices schema to support canonical multi-source semantics
-- without creating a parallel manual_invoices table.

alter table public.invoices
  add column if not exists source_type text not null default 'quote',
  add column if not exists source_id uuid,
  add column if not exists manual_title text,
  add column if not exists manual_description text,
  add column if not exists manual_customer_name text,
  add column if not exists manual_customer_email text;

-- Backfill existing rows as quote-sourced invoices.
update public.invoices
set source_type = 'quote',
    source_id = quote_id
where source_type is distinct from 'quote'
   or source_id is null;

-- quote_id must become nullable to allow future non-quote sources.
alter table public.invoices
  alter column quote_id drop not null;

-- Replace old strict quote uniqueness with source-aware uniqueness.
alter table public.invoices
  drop constraint if exists invoices_quote_unique;

create unique index if not exists invoices_quote_unique_when_source_quote
  on public.invoices (quote_id)
  where source_type = 'quote' and quote_id is not null;

-- Source and manual integrity constraints.
alter table public.invoices
  drop constraint if exists invoices_source_type_check,
  drop constraint if exists invoices_source_quote_presence_check,
  drop constraint if exists invoices_source_id_presence_check,
  drop constraint if exists invoices_manual_customer_check,
  drop constraint if exists invoices_manual_fields_scope_check;

alter table public.invoices
  add constraint invoices_source_type_check
    check (source_type in ('quote', 'pre_event', 'event', 'manual')),
  add constraint invoices_source_quote_presence_check
    check (
      (source_type = 'quote' and quote_id is not null)
      or (source_type <> 'quote' and quote_id is null)
    ),
  add constraint invoices_source_id_presence_check
    check (
      source_type = 'manual'
      or source_id is not null
    ),
  add constraint invoices_manual_customer_check
    check (
      source_type <> 'manual'
      or client_id is not null
      or nullif(btrim(coalesce(manual_customer_name, '')), '') is not null
    ),
  add constraint invoices_manual_fields_scope_check
    check (
      source_type = 'manual'
      or (
        manual_title is null
        and manual_description is null
        and manual_customer_name is null
        and manual_customer_email is null
      )
    );

comment on column public.invoices.source_type is 'Canonical invoice source semantics: quote, pre_event, event, manual.';
comment on column public.invoices.source_id is 'Reference id for source_type; for quote rows it mirrors quote_id.';
comment on column public.invoices.manual_title is 'Future manual invoice title (only for source_type=manual).';
comment on column public.invoices.manual_description is 'Future manual invoice description (only for source_type=manual).';
comment on column public.invoices.manual_customer_name is 'Manual customer display name when no linked client exists.';
comment on column public.invoices.manual_customer_email is 'Manual customer email when no linked client exists.';

-- Preserve quote accepted validation for quote-sourced invoices only.
create or replace function public.ensure_invoice_quote_is_accepted()
returns trigger
language plpgsql
as $$
declare
  target_quote_status text;
begin
  if new.source_type = 'quote' then
    if new.quote_id is null then
      raise exception 'Cannot create invoice: quote_id is required when source_type=quote.';
    end if;

    select q.status
    into target_quote_status
    from public.quotes q
    where q.id = new.quote_id;

    if target_quote_status is null then
      raise exception 'Cannot create invoice: quote not found (%).', new.quote_id;
    end if;

    if target_quote_status <> 'aceptada' then
      raise exception 'Cannot create invoice: quote % is not accepted (status=%).', new.quote_id, target_quote_status;
    end if;

    new.source_id = new.quote_id;
  else
    new.quote_id = null;
  end if;

  if new.issued_at is null and new.status in ('issued', 'partially_paid', 'paid') then
    new.issued_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_invoice_quote_is_accepted_before_write on public.invoices;
create trigger ensure_invoice_quote_is_accepted_before_write
before insert or update of quote_id, status, source_type, source_id on public.invoices
for each row execute procedure public.ensure_invoice_quote_is_accepted();
