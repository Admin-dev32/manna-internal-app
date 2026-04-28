-- Phase 8D: controlled expense categories foundation (hybrid mode).
-- Keep legacy financial_expenses.category text while enabling category_id nullable.

create table if not exists public.financial_expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  irs_category text,
  tax_sensitive boolean not null default false,
  deductible_default boolean not null default true,
  requires_receipt boolean not null default false,
  report_group text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists financial_expense_categories_slug_idx on public.financial_expense_categories (slug);
create index if not exists financial_expense_categories_active_sort_idx on public.financial_expense_categories (active, sort_order, name);

alter table public.financial_expenses
  add column if not exists category_id uuid references public.financial_expense_categories (id) on delete set null;

create index if not exists financial_expenses_category_id_idx on public.financial_expenses (category_id);

create or replace function public.touch_financial_expense_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_financial_expense_categories_updated on public.financial_expense_categories;
create trigger on_financial_expense_categories_updated
before update on public.financial_expense_categories
for each row execute procedure public.touch_financial_expense_categories_updated_at();

alter table public.financial_expense_categories enable row level security;
grant select, insert, update, delete on public.financial_expense_categories to authenticated;

drop policy if exists "Authenticated users can read financial expense categories" on public.financial_expense_categories;
create policy "Authenticated users can read financial expense categories"
on public.financial_expense_categories
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.expenses.view')
    or public.current_user_has_permission('finance.expenses.manage')
    or public.current_user_has_permission('finance.expenses.approve')
  )
);

drop policy if exists "Authenticated users can manage financial expense categories" on public.financial_expense_categories;
create policy "Authenticated users can manage financial expense categories"
on public.financial_expense_categories
for all
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('finance.expenses.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_has_permission('finance.expenses.manage')
);

insert into public.financial_expense_categories (
  name,
  slug,
  description,
  irs_category,
  tax_sensitive,
  deductible_default,
  requires_receipt,
  report_group,
  active,
  sort_order
)
values
  ('Food & Ingredients', 'food_ingredients', 'Consumables and ingredients used for events.', 'supplies', false, true, true, 'Cost of Goods Sold', true, 10),
  ('Event Supplies', 'event_supplies', 'Disposable and event-specific supplies.', 'supplies', false, true, true, 'Cost of Goods Sold', true, 20),
  ('Equipment & Tools', 'equipment_tools', 'Equipment purchases and tools.', 'equipment', false, true, true, 'Equipment', true, 30),
  ('Contractor Labor', 'contractor_labor', 'Payments to contractors and temporary labor.', 'contract_labor', true, true, false, 'Labor', true, 40),
  ('Marketing & Advertising', 'marketing_advertising', 'Paid marketing, advertising and campaigns.', 'advertising', false, true, true, 'Operating Expenses', true, 50),
  ('Vehicle & Fuel', 'vehicle_fuel', 'Vehicle expenses, mileage and fuel.', 'vehicle', true, true, true, 'Operating Expenses', true, 60),
  ('Office & Software', 'office_software', 'Office supplies and software subscriptions.', 'office_expense', false, true, true, 'Operating Expenses', true, 70),
  ('Rent & Storage', 'rent_storage', 'Rent, storage and facilities costs.', 'rent', true, true, true, 'Operating Expenses', true, 80),
  ('Fees & Processing', 'fees_processing', 'Bank, payment processing and platform fees.', 'bank_fees', false, true, false, 'Operating Expenses', true, 90),
  ('Other', 'other', 'Fallback category for uncategorized expenses.', 'other', false, true, false, 'Other', true, 999)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  irs_category = excluded.irs_category,
  tax_sensitive = excluded.tax_sensitive,
  deductible_default = excluded.deductible_default,
  requires_receipt = excluded.requires_receipt,
  report_group = excluded.report_group,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());
