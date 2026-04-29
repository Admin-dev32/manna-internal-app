-- Phase 9C: invoice_payments subledger foundation + invoice sales tax header fields.
-- Guardrails:
-- - no ledger/journal tables
-- - no posting engine
-- - payment_links remain intent/channel only

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null,
  payment_method text not null check (payment_method in ('stripe', 'zelle', 'cash', 'card', 'bank_transfer', 'manual_adjustment', 'other')),
  provider text,
  provider_payment_id text,
  reference text,
  source_type text not null default 'manual' check (source_type in ('webhook', 'manual', 'import', 'internal_api')),
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed', 'reversed', 'refunded')),
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  net_amount numeric(12,2) generated always as (amount - fee_amount) stored,
  deposited_to_account_id uuid references public.chart_of_accounts (id) on delete set null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint invoice_payments_fee_not_greater_than_amount check (fee_amount <= amount)
);

comment on table public.invoice_payments is 'Phase 9C canonical invoice payment records (real payments only; not payment link intent).';

create index if not exists invoice_payments_invoice_date_idx on public.invoice_payments (invoice_id, payment_date desc);
create index if not exists invoice_payments_status_date_idx on public.invoice_payments (status, payment_date desc);
create index if not exists invoice_payments_provider_payment_id_idx on public.invoice_payments (provider, provider_payment_id);
create index if not exists invoice_payments_deposited_to_account_idx on public.invoice_payments (deposited_to_account_id);
create unique index if not exists invoice_payments_provider_payment_id_unique
  on public.invoice_payments (provider, provider_payment_id)
  where provider_payment_id is not null;

alter table public.invoice_payments enable row level security;
grant select, insert, update on public.invoice_payments to authenticated;

drop policy if exists "Authenticated users can read invoice payments" on public.invoice_payments;
create policy "Authenticated users can read invoice payments"
on public.invoice_payments
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.payments.view')
    or public.current_user_has_permission('finance.invoices.view')
    or public.current_user_has_permission('finance.invoices.manage')
  )
);

drop policy if exists "Authenticated users can manage invoice payments" on public.invoice_payments;
create policy "Authenticated users can manage invoice payments"
on public.invoice_payments
for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.payments.manage')
    or public.current_user_has_permission('finance.invoices.manage')
  )
)
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.payments.manage')
    or public.current_user_has_permission('finance.invoices.manage')
  )
);

alter table public.invoices
  add column if not exists taxable_amount numeric(12,2) not null default 0,
  add column if not exists non_taxable_amount numeric(12,2) not null default 0,
  add column if not exists tax_rate numeric(8,6) not null default 0,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists tax_jurisdiction text,
  add column if not exists tax_region text,
  add column if not exists tax_exemption_reason text,
  add column if not exists sales_tax_payable_account_id uuid references public.chart_of_accounts (id) on delete set null;

alter table public.invoices
  drop constraint if exists invoices_taxable_amount_non_negative,
  drop constraint if exists invoices_non_taxable_amount_non_negative,
  drop constraint if exists invoices_tax_rate_non_negative,
  drop constraint if exists invoices_tax_amount_non_negative;

alter table public.invoices
  add constraint invoices_taxable_amount_non_negative check (taxable_amount >= 0),
  add constraint invoices_non_taxable_amount_non_negative check (non_taxable_amount >= 0),
  add constraint invoices_tax_rate_non_negative check (tax_rate >= 0),
  add constraint invoices_tax_amount_non_negative check (tax_amount >= 0);

create index if not exists invoices_sales_tax_payable_account_idx on public.invoices (sales_tax_payable_account_id);

update public.invoices
set
  taxable_amount = 0,
  non_taxable_amount = coalesce(total_amount, 0),
  tax_rate = 0,
  tax_amount = 0
where true;

comment on column public.invoices.taxable_amount is 'Taxable base captured at invoice header for Phase 9C (no line-level tax yet).';
comment on column public.invoices.non_taxable_amount is 'Non-taxable base captured at invoice header for Phase 9C.';
comment on column public.invoices.tax_rate is 'Effective sales tax rate at invoice header level.';
comment on column public.invoices.tax_amount is 'Sales tax amount at invoice header level (may include manual rounding adjustments).';
comment on column public.invoices.sales_tax_payable_account_id is 'Mapped liability account used later by posting engine/ledger phases.';
