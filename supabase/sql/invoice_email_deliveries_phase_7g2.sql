-- Phase 7G.2: trazabilidad de envíos de invoice por email (sin envío funcional todavía).

create table if not exists public.invoice_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  purpose text not null check (purpose in ('invoice_delivery', 'invoice_reminder')),
  sent_to text not null,
  subject text not null,
  provider text,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists invoice_email_deliveries_invoice_idx
  on public.invoice_email_deliveries (invoice_id, created_at desc);

create index if not exists invoice_email_deliveries_status_idx
  on public.invoice_email_deliveries (status, created_at desc);

create index if not exists invoice_email_deliveries_sent_at_idx
  on public.invoice_email_deliveries (sent_at desc nulls last);

create index if not exists invoice_email_deliveries_purpose_idx
  on public.invoice_email_deliveries (purpose, created_at desc);

alter table public.invoice_email_deliveries enable row level security;

grant select, insert on public.invoice_email_deliveries to authenticated;

drop policy if exists "Finance users can read invoice email deliveries" on public.invoice_email_deliveries;
create policy "Finance users can read invoice email deliveries"
on public.invoice_email_deliveries
for select
to authenticated
using (
  public.current_user_has_permission('finance.invoices.view')
  or public.current_user_has_permission('finance.invoices.manage')
);

drop policy if exists "Finance managers can create invoice email deliveries" on public.invoice_email_deliveries;
create policy "Finance managers can create invoice email deliveries"
on public.invoice_email_deliveries
for insert
to authenticated
with check (
  public.current_user_has_permission('finance.invoices.manage')
  and sent_by = auth.uid()
);
