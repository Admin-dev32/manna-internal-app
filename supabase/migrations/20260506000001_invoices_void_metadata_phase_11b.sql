-- Phase 11B: void metadata for invoice auditability.

alter table public.invoices
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null;

comment on column public.invoices.void_reason is 'Reason supplied by finance manager when an invoice is voided.';
comment on column public.invoices.voided_at is 'UTC timestamp when invoice status was changed to void.';
comment on column public.invoices.voided_by is 'Profile id that performed invoice void action.';
