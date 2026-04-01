-- Submódulo transaccional de gastos reales (spending) dentro de finanzas.

create table if not exists public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null,
  expense_scope text not null check (expense_scope in ('event', 'general')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'usd' check (currency in ('usd')),
  expense_date date not null,
  event_id uuid references public.events (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  vendor_name text,
  notes text,
  receipt_file_name text,
  receipt_storage_bucket text,
  receipt_storage_path text,
  receipt_metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint financial_expenses_scope_event_consistency check (
    (expense_scope = 'event' and event_id is not null)
    or (expense_scope = 'general' and event_id is null)
  )
);

create index if not exists financial_expenses_scope_status_idx on public.financial_expenses (expense_scope, status, expense_date desc);
create index if not exists financial_expenses_event_idx on public.financial_expenses (event_id, expense_date desc);
create index if not exists financial_expenses_quote_idx on public.financial_expenses (quote_id, expense_date desc);

create or replace function public.touch_financial_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_financial_expenses_updated on public.financial_expenses;
create trigger on_financial_expenses_updated
before update on public.financial_expenses
for each row execute procedure public.touch_financial_expenses_updated_at();

create or replace function public.handle_financial_expense_status_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at = timezone('utc', now());
  end if;

  if new.status <> 'submitted' and old.status = 'submitted' and new.status = 'draft' then
    new.submitted_at = null;
  end if;

  if new.status = 'approved' and new.approved_at is null then
    new.approved_at = timezone('utc', now());
  end if;

  if new.status in ('draft', 'submitted') then
    new.approved_by = null;
    new.approved_at = null;
    new.rejection_reason = null;
  end if;

  if new.status = 'rejected' then
    new.approved_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists handle_financial_expense_status_fields_before_write on public.financial_expenses;
create trigger handle_financial_expense_status_fields_before_write
before insert or update on public.financial_expenses
for each row execute procedure public.handle_financial_expense_status_fields();

alter table public.financial_expenses enable row level security;
grant select, insert, update on public.financial_expenses to authenticated;

drop policy if exists "Authenticated users can read financial expenses" on public.financial_expenses;
create policy "Authenticated users can read financial expenses"
on public.financial_expenses
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

drop policy if exists "Authenticated users can create financial expenses" on public.financial_expenses;
create policy "Authenticated users can create financial expenses"
on public.financial_expenses
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.expenses.manage')
);

drop policy if exists "Authenticated users can update financial expenses" on public.financial_expenses;
create policy "Authenticated users can update financial expenses"
on public.financial_expenses
for update
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.expenses.manage')
    or public.current_user_has_permission('finance.expenses.approve')
  )
)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
  and (
    public.current_user_has_permission('finance.expenses.manage')
    or public.current_user_has_permission('finance.expenses.approve')
  )
);
