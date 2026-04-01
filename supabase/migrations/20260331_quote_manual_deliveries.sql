-- Trazabilidad de canal manual (SMS/WhatsApp/link compartido) para cotizaciones.

create table if not exists public.quote_manual_deliveries (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'manual_link')),
  payment_mode text not null check (payment_mode in ('deposit', 'full')),
  payment_link_id uuid references public.payment_links (id) on delete set null,
  link_url text not null,
  amount_to_charge numeric(12,2),
  executed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists quote_manual_deliveries_quote_idx on public.quote_manual_deliveries (quote_id, created_at desc);
create index if not exists quote_manual_deliveries_channel_idx on public.quote_manual_deliveries (channel, created_at desc);

alter table public.quote_manual_deliveries enable row level security;

grant select, insert on public.quote_manual_deliveries to authenticated;

drop policy if exists "Authenticated users can read quote manual deliveries" on public.quote_manual_deliveries;
create policy "Authenticated users can read quote manual deliveries"
on public.quote_manual_deliveries
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create quote manual deliveries" on public.quote_manual_deliveries;
create policy "Authenticated users can create quote manual deliveries"
on public.quote_manual_deliveries
for insert
to authenticated
with check (
  auth.uid() is not null
  and executed_by = auth.uid()
);
