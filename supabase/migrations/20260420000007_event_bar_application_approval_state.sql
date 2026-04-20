-- Service / Bar Customization Phase 4
-- Estado accionable de aprobación operativa por barra aplicada en evento.

alter table public.event_bar_master_template_applications
  add column if not exists approval_status text not null default 'not_approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_note text;

alter table public.event_bar_master_template_applications
  drop constraint if exists event_bar_master_template_applications_approval_status_check;

alter table public.event_bar_master_template_applications
  add constraint event_bar_master_template_applications_approval_status_check
  check (approval_status in ('not_approved', 'approved'));

create index if not exists event_bar_master_template_applications_event_approval_idx
  on public.event_bar_master_template_applications (event_id, approval_status, applied_at desc);

comment on column public.event_bar_master_template_applications.approval_status is 'Estado de aprobación operativa de la barra aplicada.';
comment on column public.event_bar_master_template_applications.approved_by is 'Perfil interno que aprobó la barra para ejecución.';
comment on column public.event_bar_master_template_applications.approved_at is 'Timestamp en que se aprobó operativamente la barra.';
comment on column public.event_bar_master_template_applications.approval_note is 'Nota opcional de aprobación/reapertura de la barra aplicada.';
