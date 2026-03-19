-- Base funcional inicial del módulo de Leads.
-- No toca clientes, cotizaciones, eventos ni otros módulos.
-- Ajusta perfiles solo lo mínimo necesario para permitir directorio de responsables activos.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  language text not null default 'es' check (language in ('es', 'en')),
  source_platform text,
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'seguimiento', 'calificado', 'ganado', 'perdido')),
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  event_type text,
  tentative_event_date date,
  tentative_event_time time,
  location text,
  guest_count integer check (guest_count is null or guest_count >= 0),
  service_interest text,
  quoted_total numeric(12,2) check (quoted_total is null or quoted_total >= 0),
  promotion_offered text,
  next_action text not null,
  follow_up_at timestamptz,
  responsible_profile_id uuid references public.profiles (id) on delete set null,
  internal_notes text,
  last_interaction_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_type text not null check (activity_type in ('creado', 'actualizado', 'nota', 'estado')),
  summary text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.leads is 'Oportunidades comerciales tempranas para seguimiento interno.';
comment on table public.lead_activities is 'Historial básico del lead, listo para crecer a bitácora completa.';

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_priority_idx on public.leads (priority);
create index if not exists leads_follow_up_idx on public.leads (follow_up_at);
create index if not exists leads_responsible_idx on public.leads (responsible_profile_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists lead_activities_lead_created_idx on public.lead_activities (lead_id, created_at desc);

create or replace function public.touch_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.sync_lead_last_interaction_at()
returns trigger
language plpgsql
as $$
begin
  update public.leads
  set last_interaction_at = new.created_at,
      updated_at = timezone('utc', now())
  where id = new.lead_id;

  return new;
end;
$$;

drop trigger if exists on_leads_updated on public.leads;
create trigger on_leads_updated
before update on public.leads
for each row execute procedure public.touch_leads_updated_at();

drop trigger if exists on_lead_activity_created on public.lead_activities;
create trigger on_lead_activity_created
after insert on public.lead_activities
for each row execute procedure public.sync_lead_last_interaction_at();

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

grant select, insert, update on public.leads to authenticated;
grant select, insert on public.lead_activities to authenticated;

-- Ajuste crítico y mínimo: permitir ver perfiles activos para asignar responsables en Leads.
drop policy if exists "Authenticated users can view active profiles directory" on public.profiles;
create policy "Authenticated users can view active profiles directory"
on public.profiles
for select
to authenticated
using (is_active = true or auth.uid() = id);

drop policy if exists "Authenticated users can read leads" on public.leads;
create policy "Authenticated users can read leads"
on public.leads
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create leads" on public.leads;
create policy "Authenticated users can create leads"
on public.leads
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update leads" on public.leads;
create policy "Authenticated users can update leads"
on public.leads
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can read lead activities" on public.lead_activities;
create policy "Authenticated users can read lead activities"
on public.lead_activities
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create lead activities" on public.lead_activities;
create policy "Authenticated users can create lead activities"
on public.lead_activities
for insert
to authenticated
with check (auth.uid() is not null);
