-- Hoja financiera interna base ligada a cotizaciones, preparada para crecer después hacia reservas/eventos.
-- Separa defaults globales editables de la copia persistida por registro comercial.

create table if not exists public.financial_settings (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'global',
  default_tax_reserve_percentage numeric(6,3) check (
    default_tax_reserve_percentage is null
    or (default_tax_reserve_percentage >= 0 and default_tax_reserve_percentage <= 100)
  ),
  default_sales_commission_percentage numeric(6,3) check (
    default_sales_commission_percentage is null
    or (default_sales_commission_percentage >= 0 and default_sales_commission_percentage <= 100)
  ),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_setting_default_expenses (
  id uuid primary key default gen_random_uuid(),
  settings_id uuid not null references public.financial_settings (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  expense_type text not null check (expense_type in ('fixed', 'percentage')),
  value numeric(12,4) not null check (value >= 0),
  calculation_base text check (
    calculation_base is null
    or calculation_base in ('gross_revenue', 'after_tax', 'after_tax_and_commission')
  ),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint financial_setting_expense_percentage_base_check check (
    (expense_type = 'fixed' and calculation_base is null)
    or (expense_type = 'percentage' and calculation_base is not null)
  )
);

create table if not exists public.quote_financial_sheets (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete cascade,
  defaults_source_settings_id uuid references public.financial_settings (id) on delete set null,
  gross_revenue numeric(12,2) not null check (gross_revenue >= 0),
  tax_reserve_percentage numeric(6,3) check (
    tax_reserve_percentage is null
    or (tax_reserve_percentage >= 0 and tax_reserve_percentage <= 100)
  ),
  sales_commission_percentage numeric(6,3) check (
    sales_commission_percentage is null
    or (sales_commission_percentage >= 0 and sales_commission_percentage <= 100)
  ),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quote_financial_expenses (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.quote_financial_sheets (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  expense_type text not null check (expense_type in ('fixed', 'percentage')),
  value numeric(12,4) not null check (value >= 0),
  calculation_base text check (
    calculation_base is null
    or calculation_base in ('gross_revenue', 'after_tax', 'after_tax_and_commission')
  ),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint quote_financial_expense_percentage_base_check check (
    (expense_type = 'fixed' and calculation_base is null)
    or (expense_type = 'percentage' and calculation_base is not null)
  )
);

comment on table public.financial_settings is 'Defaults financieros globales editables usados como sugerencia al crear nuevas hojas.';
comment on table public.quote_financial_sheets is 'Hoja financiera interna persistida por cotización.';
comment on column public.quote_financial_sheets.defaults_source_settings_id is 'Referencia opcional al set global desde el que se copió la hoja al momento de creación.';

create index if not exists financial_setting_default_expenses_settings_idx on public.financial_setting_default_expenses (settings_id, sort_order);
create index if not exists quote_financial_expenses_sheet_idx on public.quote_financial_expenses (sheet_id, sort_order);

create or replace function public.touch_financial_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_financial_settings_updated on public.financial_settings;
create trigger on_financial_settings_updated
before update on public.financial_settings
for each row execute procedure public.touch_financial_updated_at();

drop trigger if exists on_financial_setting_default_expenses_updated on public.financial_setting_default_expenses;
create trigger on_financial_setting_default_expenses_updated
before update on public.financial_setting_default_expenses
for each row execute procedure public.touch_financial_updated_at();

drop trigger if exists on_quote_financial_sheets_updated on public.quote_financial_sheets;
create trigger on_quote_financial_sheets_updated
before update on public.quote_financial_sheets
for each row execute procedure public.touch_financial_updated_at();

drop trigger if exists on_quote_financial_expenses_updated on public.quote_financial_expenses;
create trigger on_quote_financial_expenses_updated
before update on public.quote_financial_expenses
for each row execute procedure public.touch_financial_updated_at();

alter table public.financial_settings enable row level security;
alter table public.financial_setting_default_expenses enable row level security;
alter table public.quote_financial_sheets enable row level security;
alter table public.quote_financial_expenses enable row level security;

grant select, insert, update on public.financial_settings to authenticated;
grant select, insert, update, delete on public.financial_setting_default_expenses to authenticated;
grant select, insert, update on public.quote_financial_sheets to authenticated;
grant select, insert, update, delete on public.quote_financial_expenses to authenticated;

drop policy if exists "Authenticated users can read financial settings" on public.financial_settings;
create policy "Authenticated users can read financial settings"
on public.financial_settings
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create financial settings" on public.financial_settings;
create policy "Authenticated users can create financial settings"
on public.financial_settings
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update financial settings" on public.financial_settings;
create policy "Authenticated users can update financial settings"
on public.financial_settings
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can read financial setting default expenses" on public.financial_setting_default_expenses;
create policy "Authenticated users can read financial setting default expenses"
on public.financial_setting_default_expenses
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can manage financial setting default expenses" on public.financial_setting_default_expenses;
create policy "Authenticated users can manage financial setting default expenses"
on public.financial_setting_default_expenses
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can read quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can read quote financial sheets"
on public.quote_financial_sheets
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can create quote financial sheets"
on public.quote_financial_sheets
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can update quote financial sheets"
on public.quote_financial_sheets
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can read quote financial expenses" on public.quote_financial_expenses;
create policy "Authenticated users can read quote financial expenses"
on public.quote_financial_expenses
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can manage quote financial expenses" on public.quote_financial_expenses;
create policy "Authenticated users can manage quote financial expenses"
on public.quote_financial_expenses
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
