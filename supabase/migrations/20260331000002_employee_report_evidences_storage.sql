-- Evidencias reales de empleados usando Supabase Storage.

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
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists employee_report_evidences_report_idx
  on public.employee_report_evidences (report_id, created_at desc);

alter table public.employee_report_evidences enable row level security;
grant select, insert on public.employee_report_evidences to authenticated;

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
