-- Storage privado para comprobantes de financial_expenses (Fase 5).

insert into storage.buckets (id, name, public)
values ('finance-receipts', 'finance-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Finance expenses can upload receipt objects" on storage.objects;
create policy "Finance expenses can upload receipt objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'finance-receipts'
  and public.current_user_has_permission('finance.expenses.manage')
);

drop policy if exists "Finance expenses can read receipt objects" on storage.objects;
create policy "Finance expenses can read receipt objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'finance-receipts'
  and (
    public.current_user_has_permission('finance.expenses.view')
    or public.current_user_has_permission('finance.expenses.manage')
    or public.current_user_has_permission('finance.expenses.approve')
  )
);

drop policy if exists "Finance expenses can update receipt objects" on storage.objects;
create policy "Finance expenses can update receipt objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'finance-receipts'
  and public.current_user_has_permission('finance.expenses.manage')
)
with check (
  bucket_id = 'finance-receipts'
  and public.current_user_has_permission('finance.expenses.manage')
);

drop policy if exists "Finance expenses can delete receipt objects" on storage.objects;
create policy "Finance expenses can delete receipt objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'finance-receipts'
  and public.current_user_has_permission('finance.expenses.manage')
);
