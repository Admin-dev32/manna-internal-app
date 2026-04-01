-- Extiende trazabilidad financiera para permitir eventos de invoice.

alter table public.financial_change_logs
  drop constraint if exists financial_change_logs_entity_type_check;

alter table public.financial_change_logs
  add constraint financial_change_logs_entity_type_check
  check (entity_type in ('settings_defaults', 'quote_sheet', 'invoice'));

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
    or public.current_user_has_permission('finance.invoices.manage')
  )
);
