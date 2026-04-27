-- Contractor payouts subledger foundation (Phase 6C).
-- Architecture alignment: Option C hybrid (operational payout subledger + future finance posting).

create table if not exists public.contractor_payouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  event_id uuid references public.events (id) on delete set null,
  assignment_id uuid references public.event_staff_assignments (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'usd' check (currency in ('usd')),
  payout_date date,
  payment_method text not null default 'other' check (payment_method in ('cash', 'zelle', 'bank_transfer', 'card', 'other')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'cancelled', 'reversed')),
  notes text,
  external_reference text,
  source_expense_id uuid references public.financial_expenses (id) on delete set null,
  idempotency_key text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contractor_payouts_assignment_requires_event check (
    assignment_id is null or event_id is not null
  )
);

create index if not exists contractor_payouts_profile_idx on public.contractor_payouts (profile_id, payout_date desc);
create index if not exists contractor_payouts_event_idx on public.contractor_payouts (event_id, payout_date desc);
create index if not exists contractor_payouts_status_idx on public.contractor_payouts (status, payout_date desc);
create index if not exists contractor_payouts_source_expense_idx on public.contractor_payouts (source_expense_id);
create unique index if not exists contractor_payouts_idempotency_key_unique
  on public.contractor_payouts (idempotency_key)
  where idempotency_key is not null;

comment on table public.contractor_payouts is 'Operational subledger for contractor payouts (Phase 6C foundation).';
comment on column public.contractor_payouts.assignment_id is 'Optional event_staff_assignment context; if present, event_id must also be present.';
comment on column public.contractor_payouts.source_expense_id is 'Optional link to financial_expenses for controlled finance integration.';
comment on column public.contractor_payouts.idempotency_key is 'Optional key to prevent duplicate payout registrations.';

-- NOTE:
-- assignment_id -> event_id consistency (assignment.event_id = contractor_payouts.event_id)
-- requires trigger or server-action validation because CHECK constraints cannot reference other rows/tables.
-- Deferred to Phase 6D implementation hardening.

create or replace function public.touch_contractor_payouts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_contractor_payouts_updated on public.contractor_payouts;
create trigger on_contractor_payouts_updated
before update on public.contractor_payouts
for each row execute procedure public.touch_contractor_payouts_updated_at();

alter table public.contractor_payouts enable row level security;
grant select, insert, update on public.contractor_payouts to authenticated;

-- Base policies for Phase 6C reuse existing finance.expenses.* permissions.
-- Future phase may transition to dedicated finance.payouts.* permissions.
drop policy if exists "Authenticated users can read contractor payouts" on public.contractor_payouts;
create policy "Authenticated users can read contractor payouts"
on public.contractor_payouts
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

drop policy if exists "Authenticated users can create contractor payouts" on public.contractor_payouts;
create policy "Authenticated users can create contractor payouts"
on public.contractor_payouts
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.expenses.manage')
);

drop policy if exists "Authenticated users can update contractor payouts" on public.contractor_payouts;
create policy "Authenticated users can update contractor payouts"
on public.contractor_payouts
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
