-- Base mínima para conversión controlada de lead a cliente.
-- No implementa todavía el módulo completo de clientes ni eventos.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete restrict,
  source_quote_id uuid unique,
  full_name text not null,
  phone text,
  email text,
  preferred_language text check (preferred_language is null or preferred_language in ('es', 'en')),
  location text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.clients is 'Base mínima de clientes creados a partir de leads aceptados.';
comment on column public.clients.source_quote_id is 'Cotización aceptada usada para la conversión inicial.';

create index if not exists clients_created_at_idx on public.clients (created_at desc);
create index if not exists clients_email_idx on public.clients (email);

create or replace function public.touch_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_clients_updated on public.clients;
create trigger on_clients_updated
before update on public.clients
for each row execute procedure public.touch_clients_updated_at();

alter table public.clients enable row level security;

grant select, insert, update on public.clients to authenticated;

drop policy if exists "Authenticated users can read clients" on public.clients;
create policy "Authenticated users can read clients"
on public.clients
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create clients" on public.clients;
create policy "Authenticated users can create clients"
on public.clients
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update clients" on public.clients;
create policy "Authenticated users can update clients"
on public.clients
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);
