-- Base para app de empleados: reportes operativos, evidencias y flujo review/bonus.

create table if not exists public.employee_event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  assignment_id uuid not null references public.event_staff_assignments (id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles (id) on delete restrict,
  report_stage text not null check (report_stage in (
    'llegada',
    'montaje_en_proceso',
    'barra_terminada',
    'servicio_en_accion',
    'cierre_area_limpia',
    'inventario_guardado',
    'actualizacion_general'
  )),
  status_update text,
  service_notes text,
  evidence_urls jsonb not null default '[]'::jsonb,
  review_status text not null default 'pendiente_revision' check (review_status in ('pendiente_revision', 'en_revision', 'aprobado', 'observado', 'requiere_correccion', 'bonus_liberado')),
  review_notes text,
  bonus_amount numeric(10, 2),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  correction_requested_at timestamptz,
  bonus_released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists employee_event_reports_reporter_idx on public.employee_event_reports (reporter_profile_id, created_at desc);
create index if not exists employee_event_reports_review_idx on public.employee_event_reports (review_status, created_at desc);

create table if not exists public.employee_assignment_availability (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.event_staff_assignments (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  availability_status text not null default 'unavailable_reported' check (availability_status in ('unavailable_reported', 'withdrawn')),
  reason text not null,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, profile_id)
);

create index if not exists employee_assignment_availability_status_idx
  on public.employee_assignment_availability (availability_status, created_at desc);

create or replace function public.touch_employee_ops_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_employee_event_reports_updated on public.employee_event_reports;
create trigger on_employee_event_reports_updated
before update on public.employee_event_reports
for each row execute procedure public.touch_employee_ops_updated_at();

drop trigger if exists on_employee_assignment_availability_updated on public.employee_assignment_availability;
create trigger on_employee_assignment_availability_updated
before update on public.employee_assignment_availability
for each row execute procedure public.touch_employee_ops_updated_at();

alter table public.employee_event_reports enable row level security;
alter table public.employee_assignment_availability enable row level security;

grant select, insert, update on public.employee_event_reports to authenticated;
grant select, insert, update on public.employee_assignment_availability to authenticated;

drop policy if exists "Employees can read own reports and managers can read all" on public.employee_event_reports;
create policy "Employees can read own reports and managers can read all"
on public.employee_event_reports
for select
to authenticated
using (
  reporter_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

drop policy if exists "Employees can create own reports" on public.employee_event_reports;
create policy "Employees can create own reports"
on public.employee_event_reports
for insert
to authenticated
with check (reporter_profile_id = auth.uid());

drop policy if exists "Managers can review reports" on public.employee_event_reports;
create policy "Managers can review reports"
on public.employee_event_reports
for update
to authenticated
using (
  reporter_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
)
with check (
  reporter_profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

drop policy if exists "Employees can read own availability and managers can read all" on public.employee_assignment_availability;
create policy "Employees can read own availability and managers can read all"
on public.employee_assignment_availability
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

drop policy if exists "Employees can upsert own availability" on public.employee_assignment_availability;
create policy "Employees can upsert own availability"
on public.employee_assignment_availability
for insert
to authenticated
with check (profile_id = auth.uid() and updated_by = auth.uid());

drop policy if exists "Employees and managers can update availability" on public.employee_assignment_availability;
create policy "Employees and managers can update availability"
on public.employee_assignment_availability
for update
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
)
with check (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

insert into storage.buckets (id, name, public)
values ('employee-evidences', 'employee-evidences', false)
on conflict (id) do nothing;

create table if not exists public.employee_report_evidences (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.employee_event_reports (id) on delete cascade,
  storage_bucket text not null default 'employee-evidences',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  is_discarded boolean not null default false,
  discarded_by uuid references public.profiles (id) on delete set null,
  discarded_at timestamptz,
  discard_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists employee_report_evidences_report_idx
  on public.employee_report_evidences (report_id, created_at desc);

alter table public.employee_report_evidences enable row level security;
grant select, insert, update on public.employee_report_evidences to authenticated;

drop policy if exists "Employees and managers can read evidences" on public.employee_report_evidences;
create policy "Employees and managers can read evidences"
on public.employee_report_evidences
for select
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

drop policy if exists "Employees can upload own evidences" on public.employee_report_evidences;
create policy "Employees can upload own evidences"
on public.employee_report_evidences
for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "Managers can discard evidences" on public.employee_report_evidences;
create policy "Managers can discard evidences"
on public.employee_report_evidences
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
  )
);

drop policy if exists "Employees can upload storage objects" on storage.objects;
create policy "Employees can upload storage objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-evidences'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "Employees and managers can read storage objects" on storage.objects;
create policy "Employees and managers can read storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'employee-evidences'
  and (
    auth.uid()::text = split_part(name, '/', 1)
    or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'manager')
    )
  )
);
