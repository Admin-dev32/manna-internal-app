-- Endurece permisos finos para finanzas y agrega trazabilidad simple de cambios.

create table if not exists public.financial_change_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('settings_defaults', 'quote_sheet')),
  quote_id uuid references public.quotes (id) on delete cascade,
  settings_id uuid references public.financial_settings (id) on delete set null,
  change_kind text not null,
  summary_payload jsonb not null default '{}'::jsonb,
  changed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists financial_change_logs_quote_idx on public.financial_change_logs (quote_id, created_at desc);
create index if not exists financial_change_logs_entity_idx on public.financial_change_logs (entity_type, created_at desc);

alter table public.financial_change_logs enable row level security;
grant select, insert on public.financial_change_logs to authenticated;

drop policy if exists "Authenticated users can read financial change logs" on public.financial_change_logs;
create policy "Authenticated users can read financial change logs"
on public.financial_change_logs
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.view_event_summary')
  )
);

drop policy if exists "Authenticated users can create financial change logs" on public.financial_change_logs;
create policy "Authenticated users can create financial change logs"
on public.financial_change_logs
for insert
to authenticated
with check (
  auth.uid() is not null
  and changed_by = auth.uid()
  and (
    public.current_user_has_permission('finance.manage_defaults')
    or public.current_user_has_permission('finance.edit_quote_sheet')
  )
);

drop policy if exists "Authenticated users can read financial settings" on public.financial_settings;
create policy "Authenticated users can read financial settings"
on public.financial_settings
for select
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.view'));

drop policy if exists "Authenticated users can create financial settings" on public.financial_settings;
create policy "Authenticated users can create financial settings"
on public.financial_settings
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.manage_defaults')
);

drop policy if exists "Authenticated users can update financial settings" on public.financial_settings;
create policy "Authenticated users can update financial settings"
on public.financial_settings
for update
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.manage_defaults'))
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.manage_defaults')
);

drop policy if exists "Authenticated users can read financial setting default expenses" on public.financial_setting_default_expenses;
create policy "Authenticated users can read financial setting default expenses"
on public.financial_setting_default_expenses
for select
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.view'));

drop policy if exists "Authenticated users can manage financial setting default expenses" on public.financial_setting_default_expenses;
create policy "Authenticated users can manage financial setting default expenses"
on public.financial_setting_default_expenses
for all
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.manage_defaults'))
with check (auth.uid() is not null and public.current_user_has_permission('finance.manage_defaults'));

drop policy if exists "Authenticated users can read quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can read quote financial sheets"
on public.quote_financial_sheets
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.view_event_summary')
  )
);

drop policy if exists "Authenticated users can create quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can create quote financial sheets"
on public.quote_financial_sheets
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.edit_quote_sheet')
);

drop policy if exists "Authenticated users can update quote financial sheets" on public.quote_financial_sheets;
create policy "Authenticated users can update quote financial sheets"
on public.quote_financial_sheets
for update
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.edit_quote_sheet'))
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
  and public.current_user_has_permission('finance.edit_quote_sheet')
);

drop policy if exists "Authenticated users can read quote financial expenses" on public.quote_financial_expenses;
create policy "Authenticated users can read quote financial expenses"
on public.quote_financial_expenses
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_user_has_permission('finance.view')
    or public.current_user_has_permission('finance.view_event_summary')
  )
);

drop policy if exists "Authenticated users can manage quote financial expenses" on public.quote_financial_expenses;
create policy "Authenticated users can manage quote financial expenses"
on public.quote_financial_expenses
for all
to authenticated
using (auth.uid() is not null and public.current_user_has_permission('finance.edit_quote_sheet'))
with check (auth.uid() is not null and public.current_user_has_permission('finance.edit_quote_sheet'));
