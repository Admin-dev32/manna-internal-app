-- Phase 9B: chart of accounts + finance account mappings foundation.
-- Scope guardrails:
-- - no ledger tables
-- - no posting engine
-- - no invoice/payment flow logic changes

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (
    account_type in (
      'asset',
      'liability',
      'equity',
      'income',
      'cost_of_goods_sold',
      'expense',
      'other_income',
      'other_expense'
    )
  ),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  parent_account_id uuid references public.chart_of_accounts (id) on delete set null,
  description text,
  active boolean not null default true,
  system_account boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.chart_of_accounts is 'Phase 9B foundation: canonical chart of accounts for future subledgers/GL posting.';
comment on column public.chart_of_accounts.system_account is 'Marks protected core accounts used by canonical finance mappings.';

create index if not exists chart_of_accounts_account_type_idx on public.chart_of_accounts (account_type);
create index if not exists chart_of_accounts_active_idx on public.chart_of_accounts (active);
create index if not exists chart_of_accounts_parent_idx on public.chart_of_accounts (parent_account_id);

create or replace function public.touch_chart_of_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_chart_of_accounts_updated on public.chart_of_accounts;
create trigger on_chart_of_accounts_updated
before update on public.chart_of_accounts
for each row execute procedure public.touch_chart_of_accounts_updated_at();

alter table public.chart_of_accounts enable row level security;
grant select, insert, update on public.chart_of_accounts to authenticated;

drop policy if exists "Authenticated users can read chart of accounts" on public.chart_of_accounts;
create policy "Authenticated users can read chart of accounts"
on public.chart_of_accounts
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.expenses.view')
    or public.current_user_has_permission('finance.invoices.view')
    or public.current_user_has_permission('finance.accounts.view')
  )
);

drop policy if exists "Authenticated users can manage chart of accounts" on public.chart_of_accounts;
create policy "Authenticated users can manage chart of accounts"
on public.chart_of_accounts
for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.accounts.manage')
    or public.current_user_has_permission('finance.expenses.manage')
  )
)
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.accounts.manage')
    or public.current_user_has_permission('finance.expenses.manage')
  )
);

insert into public.chart_of_accounts (code, name, account_type, normal_balance, description, active, system_account)
values
  ('1000', 'Cash / Bank', 'asset', 'debit', 'Primary operating cash and bank account.', true, true),
  ('1010', 'Undeposited Funds', 'asset', 'debit', 'Holding account for received funds pending deposit/reconciliation.', true, false),
  ('1100', 'Accounts Receivable', 'asset', 'debit', 'Outstanding customer invoices.', true, true),
  ('2100', 'Sales Tax Payable', 'liability', 'credit', 'Liability for collected sales tax pending remittance.', true, true),
  ('2200', 'Accounts Payable', 'liability', 'credit', 'Vendor and contractor obligations pending payment.', true, true),
  ('3000', 'Owner Equity', 'equity', 'credit', 'Owner capital and equity adjustments.', true, true),
  ('4000', 'Sales Revenue', 'income', 'credit', 'Primary revenue from services and invoices.', true, true),
  ('4090', 'Discounts / Allowances', 'income', 'debit', 'Contra-income account for discounts and allowances.', true, true),
  ('5000', 'Cost of Goods Sold', 'cost_of_goods_sold', 'debit', 'Parent COGS account.', true, false),
  ('5010', 'Food & Ingredients', 'cost_of_goods_sold', 'debit', 'Consumables and ingredients for events.', true, false),
  ('5020', 'Event Supplies', 'cost_of_goods_sold', 'debit', 'Disposable and event-specific supplies.', true, false),
  ('6100', 'Contractor Labor', 'expense', 'debit', 'Contractor and temporary labor costs.', true, false),
  ('6200', 'Marketing', 'expense', 'debit', 'Marketing and advertising costs.', true, false),
  ('6300', 'Vehicle & Fuel', 'expense', 'debit', 'Vehicle, mileage and fuel costs.', true, false),
  ('6400', 'Office & Software', 'expense', 'debit', 'Office supplies and software subscriptions.', true, false),
  ('6500', 'Fees', 'expense', 'debit', 'Bank and processing fees.', true, false),
  ('6600', 'Equipment Expense', 'expense', 'debit', 'Equipment/tools expensed under current policy.', true, false)
on conflict (code) do update
set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  description = excluded.description,
  active = excluded.active,
  system_account = excluded.system_account,
  updated_at = timezone('utc', now());

-- Optional category->account mapping extension for future posting engine alignment.
alter table public.financial_expense_categories
  add column if not exists default_account_id uuid references public.chart_of_accounts (id) on delete set null;

create index if not exists financial_expense_categories_default_account_id_idx
  on public.financial_expense_categories (default_account_id);

update public.financial_expense_categories c
set default_account_id = a.id,
    updated_at = timezone('utc', now())
from public.chart_of_accounts a
where (
    (c.slug = 'food_ingredients' and a.code = '5010')
    or (c.slug = 'event_supplies' and a.code = '5020')
    or (c.slug = 'equipment_tools' and a.code = '6600')
    or (c.slug = 'contractor_labor' and a.code = '6100')
    or (c.slug = 'marketing_advertising' and a.code = '6200')
    or (c.slug = 'vehicle_fuel' and a.code = '6300')
    or (c.slug = 'office_software' and a.code = '6400')
    or (c.slug = 'fees_processing' and a.code = '6500')
    or (c.slug = 'other' and a.code = '6500')
  )
  and (c.default_account_id is distinct from a.id);

create table if not exists public.finance_account_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_key text not null unique,
  account_id uuid not null references public.chart_of_accounts (id) on delete restrict,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.finance_account_mappings is 'Phase 9B canonical mapping keys to chart_of_accounts records.';

create index if not exists finance_account_mappings_active_idx on public.finance_account_mappings (active);
create index if not exists finance_account_mappings_account_id_idx on public.finance_account_mappings (account_id);

create or replace function public.touch_finance_account_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_finance_account_mappings_updated on public.finance_account_mappings;
create trigger on_finance_account_mappings_updated
before update on public.finance_account_mappings
for each row execute procedure public.touch_finance_account_mappings_updated_at();

alter table public.finance_account_mappings enable row level security;
grant select, insert, update on public.finance_account_mappings to authenticated;

drop policy if exists "Authenticated users can read finance account mappings" on public.finance_account_mappings;
create policy "Authenticated users can read finance account mappings"
on public.finance_account_mappings
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.expenses.view')
    or public.current_user_has_permission('finance.invoices.view')
    or public.current_user_has_permission('finance.accounts.view')
  )
);

drop policy if exists "Authenticated users can manage finance account mappings" on public.finance_account_mappings;
create policy "Authenticated users can manage finance account mappings"
on public.finance_account_mappings
for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.accounts.manage')
    or public.current_user_has_permission('finance.expenses.manage')
  )
)
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.accounts.manage')
    or public.current_user_has_permission('finance.expenses.manage')
  )
);

insert into public.finance_account_mappings (mapping_key, account_id, description, active)
select seed.mapping_key, account.id, seed.description, true
from (
  values
    ('default_cash_account', '1000', 'Primary cash/bank account for receipts and disbursements.'),
    ('undeposited_funds_account', '1010', 'Holding account for receipts not yet deposited.'),
    ('accounts_receivable_account', '1100', 'Canonical accounts receivable account.'),
    ('accounts_payable_account', '2200', 'Canonical accounts payable account.'),
    ('sales_revenue_account', '4000', 'Default sales revenue account.'),
    ('sales_tax_payable_account', '2100', 'Default liability account for collected sales tax.'),
    ('discounts_account', '4090', 'Default contra-income account for invoice discounts.'),
    ('default_expense_account', '6500', 'Fallback expense account when no specific mapping exists.'),
    ('contractor_labor_account', '6100', 'Default expense account for contractor payouts/labor.'),
    ('merchant_fees_account', '6500', 'Default expense account for processing fees.'),
    ('owner_equity_account', '3000', 'Default owner equity account for capital adjustments.')
) as seed(mapping_key, account_code, description)
join public.chart_of_accounts account
  on account.code = seed.account_code
on conflict (mapping_key) do update
set
  account_id = excluded.account_id,
  description = excluded.description,
  active = excluded.active,
  updated_at = timezone('utc', now());
