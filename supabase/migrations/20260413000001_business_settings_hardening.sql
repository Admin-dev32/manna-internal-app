create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Manna Snack Bars',
  logo_url text,
  website_url text not null default 'https://mannasnackbars.com',
  zelle_recipient_name text,
  zelle_recipient_contact text,
  zelle_instructions text not null default 'También aceptamos pago por Zelle. Responde este correo con tu comprobante para confirmar tu fecha.',
  email_from_name text not null default 'Manna Snack Bars',
  email_reply_to text,
  operational_timezone text not null default 'America/Los_Angeles',
  internal_payments_source text not null default 'manna_internal_app',
  internal_payments_system text not null default 'stripe',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.business_settings is 'Configuración operativa no sensible editable por admins para branding comercial y parámetros de pagos.';

comment on column public.business_settings.internal_payments_source is 'Valor no secreto enviado como metadata/source al sistema interno de cobros.';
comment on column public.business_settings.internal_payments_system is 'Valor no secreto para identificar sistema comercial (por ejemplo stripe).';
comment on column public.business_settings.operational_timezone is 'Timezone operativa para payloads y contextos comerciales no sensibles.';

create index if not exists business_settings_updated_at_idx on public.business_settings (updated_at desc);

drop trigger if exists on_business_settings_updated on public.business_settings;
create trigger on_business_settings_updated
before update on public.business_settings
for each row execute procedure public.touch_admin_updated_at();

alter table public.business_settings enable row level security;

grant select, insert, update on public.business_settings to authenticated;

drop policy if exists "Authenticated users can read business settings" on public.business_settings;
create policy "Authenticated users can read business settings"
on public.business_settings
for select
to authenticated
using (public.current_user_has_permission('settings.view'));

drop policy if exists "Authenticated users can create business settings" on public.business_settings;
create policy "Authenticated users can create business settings"
on public.business_settings
for insert
to authenticated
with check (public.current_user_has_permission('settings.view'));

drop policy if exists "Authenticated users can update business settings" on public.business_settings;
create policy "Authenticated users can update business settings"
on public.business_settings
for update
to authenticated
using (public.current_user_has_permission('settings.view'))
with check (public.current_user_has_permission('settings.view'));
