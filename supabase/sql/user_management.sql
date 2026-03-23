-- User management real para administración interna.
-- Agrega overrides por usuario, owner protegido y bootstrap del site owner principal.

create table if not exists public.user_access_controls (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  is_site_owner boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_access_controls is 'Controles administrativos sensibles por usuario. Solo se exponen vía funciones admin.';
comment on column public.user_access_controls.is_site_owner is 'Marca al propietario principal del sitio con protecciones anti-lockout.';
comment on column public.user_access_controls.admin_notes is 'Notas internas administrativas visibles solo en user management.';

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null,
  effect text not null check (effect in ('grant', 'revoke')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_permission_overrides_unique unique (user_id, permission_key)
);

comment on table public.user_permission_overrides is 'Overrides granulares para ampliar o restringir permisos base por usuario.';
comment on column public.user_permission_overrides.effect is 'grant agrega un permiso; revoke lo quita aunque venga por rol.';

create or replace function public.touch_admin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.get_known_permissions()
returns text[]
language sql
immutable
as $$
  select array[
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'notifications.view',
    'communication.view',
    'employees.view',
    'finance.view',
    'inventory.view',
    'settings.view',
    'audit.view',
    'admin.users.manage'
  ]::text[];
$$;

create or replace function public.get_role_permissions(target_role text)
returns text[]
language sql
immutable
as $$
  select case target_role
    when 'owner' then public.get_known_permissions()
    when 'manager' then array[
      'dashboard.view',
      'crm.view',
      'quotes.view',
      'events.view',
      'tasks.view',
      'notifications.view',
      'communication.view',
      'employees.view',
      'finance.view',
      'inventory.view'
    ]::text[]
    else array[
      'dashboard.view',
      'tasks.view',
      'notifications.view',
      'communication.view'
    ]::text[]
  end;
$$;

create or replace function public.is_primary_owner_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = target_user_id
      and lower(coalesce(email, '')) = lower('jorgermendoza18@gmail.com')
  );
$$;

create or replace function public.resolve_user_permissions(target_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assigned_role text;
  granted_permissions text[] := array[]::text[];
  revoked_permissions text[] := array[]::text[];
begin
  select role
  into assigned_role
  from public.profiles
  where id = target_user_id
    and is_active = true;

  if assigned_role is null then
    return array[]::text[];
  end if;

  if assigned_role = 'owner' then
    return public.get_known_permissions();
  end if;

  select
    coalesce(array_agg(permission_key) filter (where effect = 'grant'), array[]::text[]),
    coalesce(array_agg(permission_key) filter (where effect = 'revoke'), array[]::text[])
  into granted_permissions, revoked_permissions
  from public.user_permission_overrides
  where user_id = target_user_id;

  return (
    select coalesce(array_agg(distinct permission_key), array[]::text[])
    from (
      select unnest(public.get_role_permissions(assigned_role)) as permission_key
      union
      select unnest(granted_permissions)
    ) permission_union
    where not (permission_key = any(revoked_permissions))
  );
end;
$$;

create or replace function public.current_user_has_permission(target_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
  is_active_user boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  select role, is_active
  into current_role, is_active_user
  from public.profiles
  where id = auth.uid();

  if not coalesce(is_active_user, false) then
    return false;
  end if;

  if current_role = 'owner' then
    return true;
  end if;

  return target_permission = any(public.resolve_user_permissions(auth.uid()));
end;
$$;

create or replace function public.get_current_user_access_context()
returns table (
  user_id uuid,
  role text,
  is_active boolean,
  is_site_owner boolean,
  permissions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.role,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    public.resolve_user_permissions(p.id) as permissions
  from public.profiles p
  left join public.user_access_controls uac on uac.user_id = p.id
  where p.id = auth.uid();
$$;

create or replace function public.ensure_primary_owner_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_user auth.users%rowtype;
begin
  select *
  into owner_user
  from auth.users
  where lower(coalesce(email, '')) = lower('jorgermendoza18@gmail.com')
  order by created_at asc
  limit 1;

  if not found then
    return;
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"owner"', true),
    '{site_owner}',
    'true'::jsonb,
    true
  )
  where id = owner_user.id;

  insert into public.profiles (id, full_name, role, is_active)
  values (
    owner_user.id,
    coalesce(owner_user.raw_user_meta_data ->> 'full_name', owner_user.raw_user_meta_data ->> 'nombre', owner_user.email),
    'owner',
    true
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = 'owner',
        is_active = true,
        updated_at = timezone('utc', now());

  insert into public.user_access_controls (user_id, is_site_owner)
  values (owner_user.id, true)
  on conflict (user_id) do update
    set is_site_owner = true,
        updated_at = timezone('utc', now());

  delete from public.user_permission_overrides where user_id = owner_user.id;
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
  synced_role text := 'empleado';
begin
  select *
  into auth_user
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'No existe auth.users para id %', target_user_id;
  end if;

  if lower(coalesce(auth_user.email, '')) = lower('jorgermendoza18@gmail.com') then
    synced_role := 'owner';
  elsif coalesce(auth_user.raw_app_meta_data ->> 'role', '') in ('owner', 'manager', 'empleado') then
    synced_role := auth_user.raw_app_meta_data ->> 'role';
  end if;

  insert into public.profiles (id, full_name, role, is_active)
  values (
    auth_user.id,
    coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.raw_user_meta_data ->> 'nombre', auth_user.email),
    synced_role,
    true
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = case
          when public.is_primary_owner_user(public.profiles.id) then 'owner'
          else public.profiles.role
        end,
        is_active = case
          when public.is_primary_owner_user(public.profiles.id) then true
          else public.profiles.is_active
        end,
        updated_at = timezone('utc', now())
  returning * into profile_row;

  if lower(coalesce(auth_user.email, '')) = lower('jorgermendoza18@gmail.com') then
    insert into public.user_access_controls (user_id, is_site_owner)
    values (auth_user.id, true)
    on conflict (user_id) do update
      set is_site_owner = true,
          updated_at = timezone('utc', now());
  end if;

  return profile_row;
end;
$$;

create or replace function public.handle_auth_user_profile_changed()
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

create or replace function public.protect_primary_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_primary_owner_user(old.id) then
    if new.role <> 'owner' then
      raise exception 'El owner principal no puede perder el rol owner.';
    end if;

    if new.is_active = false then
      raise exception 'El owner principal no puede desactivarse.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_self_service_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.current_user_has_permission('admin.users.manage') then
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active then
      raise exception 'No puedes modificar tu rol o estado desde este contexto.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_primary_owner_access_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  protected_user_id uuid;
begin
  protected_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if public.is_primary_owner_user(protected_user_id) then
    if tg_op = 'DELETE' then
      raise exception 'El owner principal no puede perder la marca de site owner.';
    end if;

    if coalesce(new.is_site_owner, false) = false then
      raise exception 'El owner principal debe permanecer como site owner.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.protect_primary_owner_overrides()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  protected_user_id uuid;
begin
  protected_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if public.is_primary_owner_user(protected_user_id) then
    raise exception 'El owner principal no admite overrides de permisos.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.admin_list_users(search_term text default null)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  is_site_owner boolean,
  admin_notes text,
  granted_permissions text[],
  revoked_permissions text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    au.email,
    p.role,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    uac.admin_notes,
    coalesce(array_agg(upo.permission_key) filter (where upo.effect = 'grant'), array[]::text[]) as granted_permissions,
    coalesce(array_agg(upo.permission_key) filter (where upo.effect = 'revoke'), array[]::text[]) as revoked_permissions,
    p.created_at,
    greatest(p.updated_at, coalesce(uac.updated_at, p.updated_at)) as updated_at
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.user_access_controls uac on uac.user_id = p.id
  left join public.user_permission_overrides upo on upo.user_id = p.id
  where public.current_user_has_permission('admin.users.manage')
    and (
      search_term is null
      or btrim(search_term) = ''
      or coalesce(p.full_name, '') ilike '%' || btrim(search_term) || '%'
      or coalesce(au.email, '') ilike '%' || btrim(search_term) || '%'
    )
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, p.created_at, p.updated_at, uac.updated_at
  order by coalesce(uac.is_site_owner, false) desc, lower(coalesce(p.full_name, au.email, p.id::text)) asc;
$$;

create or replace function public.admin_get_user_detail(target_user_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  is_site_owner boolean,
  admin_notes text,
  granted_permissions text[],
  revoked_permissions text[],
  effective_permissions text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    au.email,
    p.role,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    uac.admin_notes,
    coalesce(array_agg(upo.permission_key) filter (where upo.effect = 'grant'), array[]::text[]) as granted_permissions,
    coalesce(array_agg(upo.permission_key) filter (where upo.effect = 'revoke'), array[]::text[]) as revoked_permissions,
    public.resolve_user_permissions(p.id) as effective_permissions,
    p.created_at,
    greatest(p.updated_at, coalesce(uac.updated_at, p.updated_at)) as updated_at
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.user_access_controls uac on uac.user_id = p.id
  left join public.user_permission_overrides upo on upo.user_id = p.id
  where public.current_user_has_permission('admin.users.manage')
    and p.id = target_user_id
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, p.created_at, p.updated_at, uac.updated_at;
$$;

create or replace function public.admin_update_user(
  target_user_id uuid,
  target_role text,
  target_is_active boolean,
  target_admin_notes text,
  granted_permissions text[] default array[]::text[],
  revoked_permissions text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invalid_permission text;
  profile_exists boolean := false;
begin
  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.';
  end if;

  select exists(select 1 from public.profiles where id = target_user_id) into profile_exists;
  if not profile_exists then
    raise exception 'El usuario indicado no existe en profiles.';
  end if;

  if target_role not in ('owner', 'manager', 'empleado') then
    raise exception 'Rol inválido.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(granted_permissions, array[]::text[])) permission_key
    where permission_key = any(coalesce(revoked_permissions, array[]::text[]))
  ) then
    raise exception 'Un mismo permiso no puede quedar otorgado y revocado a la vez.';
  end if;

  select permission_key
  into invalid_permission
  from (
    select unnest(coalesce(granted_permissions, array[]::text[])) as permission_key
    union all
    select unnest(coalesce(revoked_permissions, array[]::text[])) as permission_key
  ) all_permissions
  where not (permission_key = any(public.get_known_permissions()))
  limit 1;

  if invalid_permission is not null then
    raise exception 'Permiso inválido: %', invalid_permission;
  end if;

  if public.is_primary_owner_user(target_user_id) then
    if target_role <> 'owner' then
      raise exception 'El owner principal no puede perder el rol owner.';
    end if;

    if target_is_active = false then
      raise exception 'El owner principal no puede desactivarse.';
    end if;
  end if;

  update public.profiles
  set role = target_role,
      is_active = target_is_active,
      updated_at = timezone('utc', now())
  where id = target_user_id;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(target_role), true),
    '{site_owner}',
    to_jsonb(public.is_primary_owner_user(target_user_id)),
    true
  )
  where id = target_user_id;

  insert into public.user_access_controls (user_id, admin_notes, is_site_owner)
  values (
    target_user_id,
    nullif(btrim(target_admin_notes), ''),
    public.is_primary_owner_user(target_user_id)
  )
  on conflict (user_id) do update
    set admin_notes = excluded.admin_notes,
        is_site_owner = public.user_access_controls.is_site_owner or excluded.is_site_owner,
        updated_at = timezone('utc', now());

  delete from public.user_permission_overrides where user_id = target_user_id;

  if target_role <> 'owner' and not public.is_primary_owner_user(target_user_id) then
    insert into public.user_permission_overrides (user_id, permission_key, effect)
    select target_user_id, permission_key, 'grant'
    from unnest(coalesce(granted_permissions, array[]::text[])) permission_key;

    insert into public.user_permission_overrides (user_id, permission_key, effect)
    select target_user_id, permission_key, 'revoke'
    from unnest(coalesce(revoked_permissions, array[]::text[])) permission_key;
  end if;
end;
$$;

drop trigger if exists on_user_access_controls_updated on public.user_access_controls;
create trigger on_user_access_controls_updated
before update on public.user_access_controls
for each row execute procedure public.touch_admin_updated_at();

drop trigger if exists on_user_permission_overrides_updated on public.user_permission_overrides;
create trigger on_user_permission_overrides_updated
before update on public.user_permission_overrides
for each row execute procedure public.touch_admin_updated_at();

drop trigger if exists on_primary_owner_profile_protected on public.profiles;
create trigger on_primary_owner_profile_protected
before update on public.profiles
for each row execute procedure public.protect_primary_owner_profile();

drop trigger if exists on_profile_self_service_protected on public.profiles;
create trigger on_profile_self_service_protected
before update on public.profiles
for each row execute procedure public.protect_profile_self_service_fields();

drop trigger if exists on_primary_owner_access_controls_protected on public.user_access_controls;
create trigger on_primary_owner_access_controls_protected
before update or delete on public.user_access_controls
for each row execute procedure public.protect_primary_owner_access_controls();

drop trigger if exists on_primary_owner_overrides_protected on public.user_permission_overrides;
create trigger on_primary_owner_overrides_protected
before insert or update or delete on public.user_permission_overrides
for each row execute procedure public.protect_primary_owner_overrides();

drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_updated_profile
after update of email, raw_user_meta_data, raw_app_meta_data on auth.users
for each row execute procedure public.handle_auth_user_profile_changed();

alter table public.user_access_controls enable row level security;
alter table public.user_permission_overrides enable row level security;

revoke all on public.user_access_controls from anon;
revoke all on public.user_access_controls from authenticated;
revoke all on public.user_permission_overrides from anon;
revoke all on public.user_permission_overrides from authenticated;

grant execute on function public.get_current_user_access_context() to authenticated;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_update_user(uuid, text, boolean, text, text[], text[]) to authenticated;

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
on public.profiles
for update
to authenticated
using (public.current_user_has_permission('admin.users.manage'))
with check (public.current_user_has_permission('admin.users.manage'));

select public.ensure_primary_owner_account();
