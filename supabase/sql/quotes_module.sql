-- Base funcional inicial del módulo de Cotizaciones ligado a Leads.
-- No implementa todavía PDF, pagos, clientes ni eventos.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null default 'borrador' check (status in ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida')),
  subtotal numeric(12,2) check (subtotal is null or subtotal >= 0),
  discount_amount numeric(12,2) check (discount_amount is null or discount_amount >= 0),
  promotion_note text,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  expected_deposit numeric(12,2) check (expected_deposit is null or expected_deposit >= 0),
  estimated_balance numeric(12,2) check (estimated_balance is null or estimated_balance >= 0),
  notes text,
  sent_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.quotes is 'Cotizaciones comerciales básicas ligadas a leads internos.';
comment on column public.quotes.promotion_note is 'Promoción, beneficio o condición comercial aplicada a la propuesta.';
comment on column public.quotes.estimated_balance is 'Saldo estimado restante después del depósito esperado.';

create index if not exists quotes_lead_idx on public.quotes (lead_id);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_created_at_idx on public.quotes (created_at desc);
create index if not exists quotes_sent_at_idx on public.quotes (sent_at desc nulls last);

create or replace function public.touch_quotes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_quotes_updated on public.quotes;
create trigger on_quotes_updated
before update on public.quotes
for each row execute procedure public.touch_quotes_updated_at();

alter table public.quotes enable row level security;

grant select, insert, update on public.quotes to authenticated;

drop policy if exists "Authenticated users can read quotes" on public.quotes;
create policy "Authenticated users can read quotes"
on public.quotes
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create quotes" on public.quotes;
create policy "Authenticated users can create quotes"
on public.quotes
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update quotes" on public.quotes;
create policy "Authenticated users can update quotes"
on public.quotes
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);
