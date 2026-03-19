-- Base mínima de autenticación y perfiles para Manna Snack Bars.
-- Alineada con services/auth/session.ts y types/auth.ts.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'empleado' check (role in ('owner', 'manager', 'empleado')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is 'Perfil interno ligado a auth.users para empleados de Manna.';
comment on column public.profiles.role is 'Rol base usado por la app: owner, manager o empleado.';
comment on column public.profiles.is_active is 'Controla si el empleado puede usar la app interna.';

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.sync_profile_from_auth_user(target_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user auth.users%rowtype;
  profile_row public.profiles%rowtype;
begin
  select *
  into auth_user
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'No existe auth.users para id %', target_user_id;
  end if;

  insert into public.profiles (id, full_name, role, is_active)
  values (
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'nombre', auth_user.email),
    coalesce(auth_user.raw_app_meta_data ->> 'role', 'empleado'),
    true
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        updated_at = timezone('utc', now())
  returning * into profile_row;

  return profile_row;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_from_auth_user(new.id);
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_active, false)
  from public.profiles
  where id = auth.uid();
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
before update on public.profiles
for each row execute procedure public.touch_profile_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
