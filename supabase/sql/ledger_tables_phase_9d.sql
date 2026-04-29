-- Phase 9D: General Ledger tables foundation only.
-- Guardrails:
-- - no posting engine
-- - no automatic integration from invoices/payments/expenses/payouts yet

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  source_type text not null check (source_type in ('invoice_issue', 'invoice_payment', 'expense_approved', 'payout_paid', 'reversal', 'adjustment', 'opening_balance')),
  source_id text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  created_by uuid references public.profiles (id) on delete set null,
  posted_at timestamptz,
  reversed_entry_id uuid references public.journal_entries (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists journal_entries_entry_date_idx on public.journal_entries (entry_date desc);
create index if not exists journal_entries_source_idx on public.journal_entries (source_type, source_id);
create index if not exists journal_entries_status_idx on public.journal_entries (status, entry_date desc);
create index if not exists journal_entries_reversed_entry_idx on public.journal_entries (reversed_entry_id);
create unique index if not exists journal_entries_unique_posted_source
  on public.journal_entries (source_type, source_id)
  where status = 'posted';

comment on table public.journal_entries is 'Phase 9D GL foundation. Entries are draft/posted/reversed. No posting engine integration yet.';

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts (id) on delete restrict,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  memo text,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint journal_entry_lines_debit_non_negative check (debit >= 0),
  constraint journal_entry_lines_credit_non_negative check (credit >= 0),
  constraint journal_entry_lines_single_side_positive check (
    (debit > 0 and credit = 0)
    or (credit > 0 and debit = 0)
  )
);

create index if not exists journal_entry_lines_entry_idx on public.journal_entry_lines (journal_entry_id);
create index if not exists journal_entry_lines_account_idx on public.journal_entry_lines (account_id);
create index if not exists journal_entry_lines_entity_idx on public.journal_entry_lines (entity_type, entity_id);

comment on table public.journal_entry_lines is 'Phase 9D GL lines foundation. One-sided debit/credit per line.';

create or replace function public.touch_journal_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_journal_entries_updated on public.journal_entries;
create trigger on_journal_entries_updated
before update on public.journal_entries
for each row execute procedure public.touch_journal_entries_updated_at();

create or replace function public.validate_journal_entry_posting_transition()
returns trigger
language plpgsql
as $$
declare
  line_count integer;
  total_debit numeric(12,2);
  total_credit numeric(12,2);
begin
  if new.status = 'posted' and old.status <> 'posted' then
    select
      count(*),
      coalesce(sum(debit), 0),
      coalesce(sum(credit), 0)
    into line_count, total_debit, total_credit
    from public.journal_entry_lines
    where journal_entry_id = new.id;

    if line_count < 2 then
      raise exception 'Cannot post journal entry %: at least two lines are required.', new.id;
    end if;

    if total_debit <> total_credit then
      raise exception 'Cannot post journal entry %: debits (%) must equal credits (%).', new.id, total_debit, total_credit;
    end if;

    if new.posted_at is null then
      new.posted_at = timezone('utc', now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_journal_entry_posting_transition_before_update on public.journal_entries;
create trigger validate_journal_entry_posting_transition_before_update
before update of status on public.journal_entries
for each row execute procedure public.validate_journal_entry_posting_transition();

create or replace function public.prevent_posted_journal_entry_mutations()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted journal entries cannot be deleted (%).', old.id;
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    if new.status = 'reversed'
       and new.id = old.id
       and new.entry_date = old.entry_date
       and new.source_type = old.source_type
       and new.source_id = old.source_id
       and coalesce(new.description, '') = coalesce(old.description, '')
       and new.created_by is not distinct from old.created_by
       and new.created_at = old.created_at
       and new.posted_at is not distinct from old.posted_at
    then
      return new;
    end if;

    raise exception 'Posted journal entries are immutable (%).', old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_posted_journal_entry_mutations_before_update on public.journal_entries;
create trigger prevent_posted_journal_entry_mutations_before_update
before update on public.journal_entries
for each row execute procedure public.prevent_posted_journal_entry_mutations();

drop trigger if exists prevent_posted_journal_entry_mutations_before_delete on public.journal_entries;
create trigger prevent_posted_journal_entry_mutations_before_delete
before delete on public.journal_entries
for each row execute procedure public.prevent_posted_journal_entry_mutations();

create or replace function public.prevent_posted_journal_entry_line_mutations()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
  target_entry_id uuid;
begin
  target_entry_id = case when tg_op = 'DELETE' then old.journal_entry_id else new.journal_entry_id end;

  select status
  into parent_status
  from public.journal_entries
  where id = target_entry_id;

  if parent_status = 'posted' then
    raise exception 'Cannot % line: parent journal entry is posted (%).', lower(tg_op), target_entry_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_posted_journal_entry_lines_before_insert on public.journal_entry_lines;
create trigger prevent_posted_journal_entry_lines_before_insert
before insert on public.journal_entry_lines
for each row execute procedure public.prevent_posted_journal_entry_line_mutations();

drop trigger if exists prevent_posted_journal_entry_lines_before_update on public.journal_entry_lines;
create trigger prevent_posted_journal_entry_lines_before_update
before update on public.journal_entry_lines
for each row execute procedure public.prevent_posted_journal_entry_line_mutations();

drop trigger if exists prevent_posted_journal_entry_lines_before_delete on public.journal_entry_lines;
create trigger prevent_posted_journal_entry_lines_before_delete
before delete on public.journal_entry_lines
for each row execute procedure public.prevent_posted_journal_entry_line_mutations();

alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.journal_entry_lines to authenticated;

drop policy if exists "Authenticated users can read journal entries" on public.journal_entries;
create policy "Authenticated users can read journal entries"
on public.journal_entries
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.view')
    or public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.accounts.view')
  )
);

drop policy if exists "Authenticated users can manage journal entries" on public.journal_entries;
create policy "Authenticated users can manage journal entries"
on public.journal_entries
for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.post')
    or public.current_user_has_permission('finance.accounts.manage')
  )
)
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.post')
    or public.current_user_has_permission('finance.accounts.manage')
  )
);

drop policy if exists "Authenticated users can read journal entry lines" on public.journal_entry_lines;
create policy "Authenticated users can read journal entry lines"
on public.journal_entry_lines
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.view')
    or public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.accounts.view')
  )
);

drop policy if exists "Authenticated users can manage journal entry lines" on public.journal_entry_lines;
create policy "Authenticated users can manage journal entry lines"
on public.journal_entry_lines
for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.post')
    or public.current_user_has_permission('finance.accounts.manage')
  )
)
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.ledger.post')
    or public.current_user_has_permission('finance.accounts.manage')
  )
);
