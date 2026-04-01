-- Hardening de revisión y evidencias (estados, trazabilidad y descarte controlado).

alter table if exists public.employee_event_reports
  drop constraint if exists employee_event_reports_review_status_check;

alter table if exists public.employee_event_reports
  add constraint employee_event_reports_review_status_check
  check (review_status in ('pendiente_revision', 'en_revision', 'aprobado', 'observado', 'requiere_correccion', 'bonus_liberado'));

alter table if exists public.employee_event_reports
  add column if not exists correction_requested_at timestamptz;

alter table if exists public.employee_event_reports
  add column if not exists bonus_released_at timestamptz;

update public.employee_event_reports
set review_status = 'requiere_correccion'
where review_status = 'requiere_cambios';

alter table if exists public.employee_report_evidences
  add column if not exists is_discarded boolean not null default false;

alter table if exists public.employee_report_evidences
  add column if not exists discarded_by uuid references public.profiles (id) on delete set null;

alter table if exists public.employee_report_evidences
  add column if not exists discarded_at timestamptz;

alter table if exists public.employee_report_evidences
  add column if not exists discard_reason text;

grant update on public.employee_report_evidences to authenticated;

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
