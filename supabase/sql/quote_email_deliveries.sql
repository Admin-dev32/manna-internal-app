-- Trazabilidad de envíos de cotización por email.

create table if not exists public.quote_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_preview text,
  payment_link_id uuid references public.payment_links (id) on delete set null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  provider text not null,
  provider_message_id text,
  sent_by uuid not null references public.profiles (id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists quote_email_deliveries_quote_idx on public.quote_email_deliveries (quote_id, created_at desc);
create index if not exists quote_email_deliveries_status_idx on public.quote_email_deliveries (status, created_at desc);

alter table public.quote_email_deliveries enable row level security;

grant select, insert on public.quote_email_deliveries to authenticated;

drop policy if exists "Authenticated users can read quote email deliveries" on public.quote_email_deliveries;
create policy "Authenticated users can read quote email deliveries"
on public.quote_email_deliveries
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create quote email deliveries" on public.quote_email_deliveries;
create policy "Authenticated users can create quote email deliveries"
on public.quote_email_deliveries
for insert
to authenticated
with check (
  auth.uid() is not null
  and sent_by = auth.uid()
);
