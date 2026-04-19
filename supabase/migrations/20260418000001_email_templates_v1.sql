create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  purpose text not null check (purpose in ('quote_delivery', 'quote_followup', 'payment_reminder', 'event_confirmation', 'general_client_message')),
  subject_template text not null,
  html_template text not null,
  text_template text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.email_templates is 'Plantillas de email editables por admins para distintos propósitos operativos.';

create index if not exists email_templates_purpose_active_idx on public.email_templates (purpose, is_active);

create unique index if not exists email_templates_one_active_per_purpose_idx
on public.email_templates (purpose)
where is_active = true;

drop trigger if exists on_email_templates_updated on public.email_templates;
create trigger on_email_templates_updated
before update on public.email_templates
for each row execute procedure public.touch_admin_updated_at();

alter table public.email_templates enable row level security;

grant select, insert, update on public.email_templates to authenticated;

drop policy if exists "Authenticated users can read email templates" on public.email_templates;
create policy "Authenticated users can read email templates"
on public.email_templates
for select
to authenticated
using (public.current_user_has_permission('settings.view'));

drop policy if exists "Authenticated users can create email templates" on public.email_templates;
create policy "Authenticated users can create email templates"
on public.email_templates
for insert
to authenticated
with check (public.current_user_has_permission('settings.view'));

drop policy if exists "Authenticated users can update email templates" on public.email_templates;
create policy "Authenticated users can update email templates"
on public.email_templates
for update
to authenticated
using (public.current_user_has_permission('settings.view'))
with check (public.current_user_has_permission('settings.view'));
