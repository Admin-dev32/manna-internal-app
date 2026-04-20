create table if not exists public.internal_tickets (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  category text not null default 'general_request',
  event_id uuid references public.events (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  office_response text,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.internal_tickets
  drop constraint if exists internal_tickets_status_check;

alter table public.internal_tickets
  add constraint internal_tickets_status_check
  check (status in ('open', 'in_progress', 'closed'));

alter table public.internal_tickets
  drop constraint if exists internal_tickets_priority_check;

alter table public.internal_tickets
  add constraint internal_tickets_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.internal_tickets
  drop constraint if exists internal_tickets_category_check;

alter table public.internal_tickets
  add constraint internal_tickets_category_check
  check (category in ('approval', 'missing_material', 'event_issue', 'urgent_purchase', 'operational_incident', 'general_request'));

create index if not exists internal_tickets_status_idx
  on public.internal_tickets (status, priority, created_at desc);

create index if not exists internal_tickets_created_by_idx
  on public.internal_tickets (created_by, created_at desc);

create index if not exists internal_tickets_event_id_idx
  on public.internal_tickets (event_id, created_at desc);

create or replace function public.touch_internal_tickets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_internal_tickets_updated on public.internal_tickets;
create trigger on_internal_tickets_updated
before update on public.internal_tickets
for each row execute procedure public.touch_internal_tickets_updated_at();

alter table public.internal_tickets enable row level security;

grant select, insert, update on public.internal_tickets to authenticated;

drop policy if exists "Users can create internal tickets" on public.internal_tickets;
create policy "Users can create internal tickets"
on public.internal_tickets
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('internal_tickets.create')
  and created_by = auth.uid()
);

drop policy if exists "Users can read own tickets or manage inbox" on public.internal_tickets;
create policy "Users can read own tickets or manage inbox"
on public.internal_tickets
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.current_user_has_permission('internal_tickets.manage')
  )
);

drop policy if exists "Main office can update tickets" on public.internal_tickets;
create policy "Main office can update tickets"
on public.internal_tickets
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('internal_tickets.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('internal_tickets.manage')
);

comment on table public.internal_tickets is 'Tickets/solicitudes internas enviadas por operación hacia main office.';
