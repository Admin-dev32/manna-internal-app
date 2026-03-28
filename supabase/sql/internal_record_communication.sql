-- Comunicación interna contextual por registro + menciones @usuario.

create table if not exists public.internal_record_comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'quote', 'client', 'pre_event', 'event', 'event_task')),
  entity_id uuid not null,
  body text not null check (char_length(trim(body)) > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists internal_record_comments_entity_idx on public.internal_record_comments (entity_type, entity_id, created_at desc);
create index if not exists internal_record_comments_author_idx on public.internal_record_comments (created_by, created_at desc);

create table if not exists public.internal_comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.internal_record_comments (id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles (id) on delete restrict,
  mention_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint internal_comment_mentions_unique unique (comment_id, mentioned_profile_id)
);

create index if not exists internal_comment_mentions_profile_idx on public.internal_comment_mentions (mentioned_profile_id, created_at desc);

create table if not exists public.internal_mention_notifications (
  id uuid primary key default gen_random_uuid(),
  mention_id uuid not null references public.internal_comment_mentions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  entity_type text not null check (entity_type in ('lead', 'quote', 'client', 'pre_event', 'event', 'event_task')),
  entity_id uuid not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists internal_mention_notifications_profile_idx on public.internal_mention_notifications (profile_id, is_read, created_at desc);

create or replace function public.touch_internal_record_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_internal_record_comments_updated on public.internal_record_comments;
create trigger on_internal_record_comments_updated
before update on public.internal_record_comments
for each row execute procedure public.touch_internal_record_comment_updated_at();

alter table public.internal_record_comments enable row level security;
alter table public.internal_comment_mentions enable row level security;
alter table public.internal_mention_notifications enable row level security;

grant select, insert on public.internal_record_comments to authenticated;
grant select, insert on public.internal_comment_mentions to authenticated;
grant select, insert, update on public.internal_mention_notifications to authenticated;

drop policy if exists "Authenticated users can read internal comments" on public.internal_record_comments;
create policy "Authenticated users can read internal comments"
on public.internal_record_comments
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create internal comments" on public.internal_record_comments;
create policy "Authenticated users can create internal comments"
on public.internal_record_comments
for insert
to authenticated
with check (auth.uid() is not null and public.current_user_is_active() and created_by = auth.uid());

drop policy if exists "Authenticated users can read comment mentions" on public.internal_comment_mentions;
create policy "Authenticated users can read comment mentions"
on public.internal_comment_mentions
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create comment mentions" on public.internal_comment_mentions;
create policy "Authenticated users can create comment mentions"
on public.internal_comment_mentions
for insert
to authenticated
with check (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Users can read their mention notifications" on public.internal_mention_notifications;
create policy "Users can read their mention notifications"
on public.internal_mention_notifications
for select
to authenticated
using (auth.uid() = profile_id and public.current_user_is_active());

drop policy if exists "Users can create mention notifications" on public.internal_mention_notifications;
create policy "Users can create mention notifications"
on public.internal_mention_notifications
for insert
to authenticated
with check (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Users can update their mention notifications" on public.internal_mention_notifications;
create policy "Users can update their mention notifications"
on public.internal_mention_notifications
for update
to authenticated
using (auth.uid() = profile_id and public.current_user_is_active())
with check (auth.uid() = profile_id and public.current_user_is_active());
