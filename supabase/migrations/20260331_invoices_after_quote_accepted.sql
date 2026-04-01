-- Invoices internas emitidas desde cotizaciones aceptadas.
-- Se guarda snapshot comercial/operativo/financiero al emitir para trazabilidad.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete restrict,
  client_id uuid references public.clients (id) on delete set null,
  pre_event_id uuid references public.pre_events (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  invoice_number text not null,
  status text not null default 'issued' check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  currency text not null default 'usd' check (currency in ('usd')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  deposit_amount numeric(12,2) check (deposit_amount is null or deposit_amount >= 0),
  balance_due numeric(12,2) check (balance_due is null or balance_due >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  notes text,
  internal_notes text,
  customer_snapshot jsonb not null default '{}'::jsonb,
  event_snapshot jsonb not null default '{}'::jsonb,
  financial_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invoices_invoice_number_unique unique (invoice_number),
  constraint invoices_quote_unique unique (quote_id),
  constraint invoices_total_consistency check (total_amount <= subtotal),
  constraint invoices_balance_consistency check (balance_due is null or balance_due <= total_amount)
);

comment on table public.invoices is 'Invoices internas emitidas después de cotizaciones aceptadas con snapshot económico y operativo.';

create index if not exists invoices_created_at_idx on public.invoices (created_at desc);
create index if not exists invoices_status_idx on public.invoices (status, created_at desc);

create or replace function public.touch_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_invoices_updated on public.invoices;
create trigger on_invoices_updated
before update on public.invoices
for each row execute procedure public.touch_invoices_updated_at();

create or replace function public.ensure_invoice_quote_is_accepted()
returns trigger
language plpgsql
as $$
declare
  target_quote_status text;
begin
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

  if new.issued_at is null and new.status in ('issued', 'partially_paid', 'paid') then
    new.issued_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_invoice_quote_is_accepted_before_write on public.invoices;
create trigger ensure_invoice_quote_is_accepted_before_write
before insert or update of quote_id, status on public.invoices
for each row execute procedure public.ensure_invoice_quote_is_accepted();

alter table public.invoices enable row level security;
grant select, insert, update on public.invoices to authenticated;

drop policy if exists "Authenticated users can read invoices" on public.invoices;
create policy "Authenticated users can read invoices"
on public.invoices
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.invoices.view')
    or public.current_user_has_permission('finance.invoices.manage')
  )
);

drop policy if exists "Authenticated users can create invoices" on public.invoices;
create policy "Authenticated users can create invoices"
on public.invoices
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.invoices.manage')
);

drop policy if exists "Authenticated users can update invoices" on public.invoices;
create policy "Authenticated users can update invoices"
on public.invoices
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('finance.invoices.manage')
)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.invoices.manage')
);
