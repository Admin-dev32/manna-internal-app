-- Team chat híbrido v1 (global + evento).
-- Mantiene separada esta capa de internal_record_comments.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null check (conversation_type in ('global_team', 'event')),
  event_id uuid references public.events (id) on delete cascade,
  title text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.chat_conversations
  drop constraint if exists chat_conversations_event_type_consistency;

alter table public.chat_conversations
  add constraint chat_conversations_event_type_consistency
  check (
    (conversation_type = 'global_team' and event_id is null)
    or (conversation_type = 'event' and event_id is not null)
  );

create unique index if not exists chat_conversations_one_global_idx
  on public.chat_conversations (conversation_type)
  where conversation_type = 'global_team';

create unique index if not exists chat_conversations_event_unique_idx
  on public.chat_conversations (event_id)
  where conversation_type = 'event';

create index if not exists chat_conversations_active_idx
  on public.chat_conversations (is_active, updated_at desc);

create table if not exists public.chat_conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_at timestamptz,
  is_muted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chat_conversation_members_unique unique (conversation_id, profile_id)
);

create index if not exists chat_conversation_members_profile_idx
  on public.chat_conversation_members (profile_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(trim(body)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at asc);

create or replace function public.touch_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_chat_conversations_updated on public.chat_conversations;
create trigger on_chat_conversations_updated
before update on public.chat_conversations
for each row execute procedure public.touch_chat_updated_at();

drop trigger if exists on_chat_conversation_members_updated on public.chat_conversation_members;
create trigger on_chat_conversation_members_updated
before update on public.chat_conversation_members
for each row execute procedure public.touch_chat_updated_at();

drop trigger if exists on_chat_messages_updated on public.chat_messages;
create trigger on_chat_messages_updated
before update on public.chat_messages
for each row execute procedure public.touch_chat_updated_at();

create or replace function public.touch_chat_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.chat_conversations
  set updated_at = timezone('utc', now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_chat_message_insert_touch_conversation on public.chat_messages;
create trigger on_chat_message_insert_touch_conversation
after insert on public.chat_messages
for each row execute procedure public.touch_chat_conversation_on_message();

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert, update on public.chat_conversations to authenticated;
grant select, insert, update on public.chat_conversation_members to authenticated;
grant select, insert, update on public.chat_messages to authenticated;

drop policy if exists "Users can read chat conversations" on public.chat_conversations;
create policy "Users can read chat conversations"
on public.chat_conversations
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.view')
  and is_active = true
);

drop policy if exists "Users can manage chat conversations" on public.chat_conversations;
create policy "Users can manage chat conversations"
on public.chat_conversations
for all
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.manage')
);

drop policy if exists "Users can read chat members" on public.chat_conversation_members;
create policy "Users can read chat members"
on public.chat_conversation_members
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.view')
);

drop policy if exists "Users can join chat as member" on public.chat_conversation_members;
create policy "Users can join chat as member"
on public.chat_conversation_members
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.view')
  and profile_id = auth.uid()
);

drop policy if exists "Users can update own chat member row" on public.chat_conversation_members;
create policy "Users can update own chat member row"
on public.chat_conversation_members
for update
to authenticated
using (
  auth.uid() = profile_id
  and public.current_user_is_active()
)
with check (
  auth.uid() = profile_id
  and public.current_user_is_active()
);

drop policy if exists "Users can read chat messages" on public.chat_messages;
create policy "Users can read chat messages"
on public.chat_messages
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.view')
  and deleted_at is null
  and exists (
    select 1 from public.chat_conversations conversation
    where conversation.id = chat_messages.conversation_id
      and conversation.is_active = true
  )
);

drop policy if exists "Users can send chat messages" on public.chat_messages;
create policy "Users can send chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('chat.send')
  and sender_profile_id = auth.uid()
  and exists (
    select 1 from public.chat_conversations conversation
    where conversation.id = chat_messages.conversation_id
      and conversation.is_active = true
  )
);

drop policy if exists "Users can soft delete own messages" on public.chat_messages;
create policy "Users can soft delete own messages"
on public.chat_messages
for update
to authenticated
using (
  auth.uid() = sender_profile_id
  and public.current_user_is_active()
)
with check (
  auth.uid() = sender_profile_id
  and public.current_user_is_active()
);
