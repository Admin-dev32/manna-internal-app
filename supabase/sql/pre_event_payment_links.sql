-- Payment links internos para reservas/pre-eventos, consumiendo API central de pagos.
-- Mantiene trazabilidad local sin tocar el sistema maestro de webhooks.

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  source_record_type text not null check (source_record_type in ('pre_event', 'quote')),
  source_record_id uuid not null,
  payment_mode text not null check (payment_mode in ('deposit', 'full')),
  currency text not null default 'usd' check (currency in ('usd')),
  total_event_amount numeric(12,2) not null check (total_event_amount >= 0),
  amount_to_charge numeric(12,2) not null check (amount_to_charge >= 0),
  balance_due numeric(12,2) not null check (balance_due >= 0),
  external_provider text not null,
  external_payment_link_id text,
  external_url text not null,
  request_payload jsonb,
  response_payload jsonb,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.payment_links is 'Trazabilidad interna de payment links creados desde la API central de pagos.';

create index if not exists payment_links_source_idx on public.payment_links (source_record_type, source_record_id, created_at desc);
create index if not exists payment_links_external_id_idx on public.payment_links (external_payment_link_id);

create or replace function public.touch_payment_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_payment_links_updated on public.payment_links;
create trigger on_payment_links_updated
before update on public.payment_links
for each row execute procedure public.touch_payment_links_updated_at();

alter table public.payment_links enable row level security;

grant select, insert on public.payment_links to authenticated;

drop policy if exists "Authenticated users can read payment links" on public.payment_links;
create policy "Authenticated users can read payment links"
on public.payment_links
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create payment links" on public.payment_links;
create policy "Authenticated users can create payment links"
on public.payment_links
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);
