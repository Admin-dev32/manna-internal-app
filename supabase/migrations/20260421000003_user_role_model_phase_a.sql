-- USER ROLE MODEL CLEANUP PHASE A
-- Permisos alineados + base role/profile foundation sin romper arquitectura actual.

alter table public.user_access_controls
  add column if not exists operational_profile text not null default 'general_staff';

alter table public.user_access_controls
  drop constraint if exists user_access_controls_operational_profile_check;

alter table public.user_access_controls
  add constraint user_access_controls_operational_profile_check
  check (operational_profile in ('team_leader', 'assistant', 'general_staff'));

create or replace function public.normalize_profile_role(target_role text)
returns text
language sql
stable
as $$
  select case coalesce(lower(target_role), '')
    when 'owner' then 'owner'
    when 'manager' then 'manager'
    when 'supervisor' then 'manager'
    when 'empleado' then 'empleado'
    when 'employee' then 'empleado'
    else 'empleado'
  end;
$$;

create or replace function public.map_profile_role_to_base_role(target_role text)
returns text
language sql
stable
as $$
  select case public.normalize_profile_role(target_role)
    when 'owner' then 'owner'
    when 'manager' then 'supervisor'
    else 'employee'
  end;
$$;

create or replace function public.get_known_permissions()
returns text[]
language sql
stable
as $$
  select array[
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'tasks.manage',
    'tasks.assign',
    'tasks.update_status',
    'chat.view',
    'chat.send',
    'chat.manage',
    'notifications.view',
    'communication.view',
    'internal_tickets.create',
    'internal_tickets.manage',
    'employees.view',
    'finance.view',
    'finance.manage_defaults',
    'finance.edit_quote_sheet',
    'finance.view_event_summary',
    'finance.invoices.view',
    'finance.invoices.manage',
    'finance.expenses.view',
    'finance.expenses.manage',
    'finance.expenses.approve',
    'inventory.view',
    'inventory.manage',
    'inventory.prepare',
    'inventory.templates.view',
    'inventory.templates.manage',
    'settings.view',
    'audit.view',
    'admin.users.manage'
  ]::text[];
$$;

create or replace function public.get_role_permissions(target_role text)
returns text[]
language sql
stable
as $$
  select case public.normalize_profile_role(target_role)
    when 'owner' then public.get_known_permissions()
    when 'manager' then array[
      'dashboard.view',
      'crm.view',
      'quotes.view',
      'events.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view',
      'internal_tickets.create',
      'internal_tickets.manage',
      'employees.view',
      'finance.view',
      'finance.edit_quote_sheet',
      'finance.view_event_summary',
      'finance.invoices.view',
      'finance.expenses.view',
      'inventory.view',
      'inventory.manage',
      'inventory.prepare',
      'inventory.templates.view',
      'inventory.templates.manage'
    ]::text[]
    else array[
      'dashboard.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view',
      'internal_tickets.create'
    ]::text[]
  end;
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
  known_permissions text[] := public.get_known_permissions();
begin
  select public.normalize_profile_role(role)
  into assigned_role
  from public.profiles
  where id = target_user_id
    and is_active = true;

  if assigned_role is null then
    return array[]::text[];
  end if;

  if assigned_role = 'owner' then
    return known_permissions;
  end if;

  select
    coalesce(array_agg(permission_key) filter (where effect = 'grant'), array[]::text[]),
    coalesce(array_agg(permission_key) filter (where effect = 'revoke'), array[]::text[])
  into granted_permissions, revoked_permissions
  from public.user_permission_overrides
  where user_id = target_user_id;

  return (
    select coalesce(array_agg(distinct permission_key order by permission_key), array[]::text[])
    from (
      select unnest(public.get_role_permissions(assigned_role)) as permission_key
      union
      select unnest(granted_permissions)
    ) permission_union
    where permission_key = any(known_permissions)
      and not (permission_key = any(revoked_permissions))
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
  known_permissions text[] := public.get_known_permissions();
begin
  if auth.uid() is null then
    return false;
  end if;

  if target_permission is null or not (target_permission = any(known_permissions)) then
    return false;
  end if;

  select public.normalize_profile_role(role), is_active
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
  base_role text,
  is_active boolean,
  is_site_owner boolean,
  operational_profile text,
  permissions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    public.normalize_profile_role(p.role) as role,
    public.map_profile_role_to_base_role(p.role) as base_role,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    coalesce(uac.operational_profile, 'general_staff') as operational_profile,
    public.resolve_user_permissions(p.id) as permissions
  from public.profiles p
  left join public.user_access_controls uac on uac.user_id = p.id
  where p.id = auth.uid();
$$;

drop function if exists public.admin_list_users(text);
create function public.admin_list_users(search_term text default null)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  base_role text,
  operational_profile text,
  is_active boolean,
  is_site_owner boolean,
  invitation_pending boolean,
  can_resend_invitation boolean,
  can_delete_user boolean,
  last_sign_in_at timestamptz,
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
    public.normalize_profile_role(p.role) as role,
    public.map_profile_role_to_base_role(p.role) as base_role,
    coalesce(uac.operational_profile, 'general_staff') as operational_profile,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null) as invitation_pending,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null and coalesce(uac.is_site_owner, false) = false) as can_resend_invitation,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null and coalesce(uac.is_site_owner, false) = false) as can_delete_user,
    au.last_sign_in_at,
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
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, uac.operational_profile, au.invited_at, au.email_confirmed_at, au.last_sign_in_at, p.created_at, p.updated_at, uac.updated_at
  order by coalesce(uac.is_site_owner, false) desc, lower(coalesce(p.full_name, au.email, p.id::text)) asc;
$$;

drop function if exists public.admin_get_user_detail(uuid);
create function public.admin_get_user_detail(target_user_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  base_role text,
  operational_profile text,
  is_active boolean,
  is_site_owner boolean,
  invitation_pending boolean,
  can_resend_invitation boolean,
  can_delete_user boolean,
  last_sign_in_at timestamptz,
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
    public.normalize_profile_role(p.role) as role,
    public.map_profile_role_to_base_role(p.role) as base_role,
    coalesce(uac.operational_profile, 'general_staff') as operational_profile,
    p.is_active,
    coalesce(uac.is_site_owner, false) as is_site_owner,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null) as invitation_pending,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null and coalesce(uac.is_site_owner, false) = false) as can_resend_invitation,
    (au.invited_at is not null and au.email_confirmed_at is null and au.last_sign_in_at is null and coalesce(uac.is_site_owner, false) = false) as can_delete_user,
    au.last_sign_in_at,
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
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, uac.operational_profile, au.invited_at, au.email_confirmed_at, au.last_sign_in_at, p.created_at, p.updated_at, uac.updated_at;
$$;

create or replace function public.admin_update_user(
  target_user_id uuid,
  target_role text,
  target_is_active boolean,
  target_admin_notes text,
  granted_permissions text[] default array[]::text[],
  revoked_permissions text[] default array[]::text[],
  target_operational_profile text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invalid_permission text;
  profile_exists boolean := false;
  normalized_target_role text := public.normalize_profile_role(target_role);
  normalized_operational_profile text := coalesce(nullif(lower(target_operational_profile), ''), 'general_staff');
begin
  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.';
  end if;

  select exists(select 1 from public.profiles where id = target_user_id) into profile_exists;
  if not profile_exists then
    raise exception 'El usuario indicado no existe en profiles.';
  end if;

  if target_role not in ('owner', 'manager', 'empleado', 'supervisor', 'employee') then
    raise exception 'Rol inválido.';
  end if;

  if normalized_operational_profile not in ('team_leader', 'assistant', 'general_staff') then
    raise exception 'Perfil operativo inválido.';
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
    if normalized_target_role <> 'owner' then
      raise exception 'El owner principal no puede perder el rol owner.';
    end if;

    if target_is_active = false then
      raise exception 'El owner principal no puede desactivarse.';
    end if;
  end if;

  update public.profiles
  set role = normalized_target_role,
      is_active = target_is_active,
      updated_at = timezone('utc', now())
  where id = target_user_id;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(normalized_target_role), true),
      '{base_role}',
      to_jsonb(public.map_profile_role_to_base_role(normalized_target_role)),
      true
    ),
    '{site_owner}',
    to_jsonb(public.is_primary_owner_user(target_user_id)),
    true
  )
  where id = target_user_id;

  insert into public.user_access_controls (user_id, admin_notes, is_site_owner, operational_profile)
  values (
    target_user_id,
    nullif(btrim(target_admin_notes), ''),
    public.is_primary_owner_user(target_user_id),
    normalized_operational_profile
  )
  on conflict (user_id) do update
    set admin_notes = excluded.admin_notes,
        operational_profile = excluded.operational_profile,
        is_site_owner = public.user_access_controls.is_site_owner or excluded.is_site_owner,
        updated_at = timezone('utc', now());

  delete from public.user_permission_overrides where user_id = target_user_id;

  if normalized_target_role <> 'owner' and not public.is_primary_owner_user(target_user_id) then
    insert into public.user_permission_overrides (user_id, permission_key, effect)
    select target_user_id, permission_key, 'grant'
    from unnest(coalesce(granted_permissions, array[]::text[])) permission_key;

    insert into public.user_permission_overrides (user_id, permission_key, effect)
    select target_user_id, permission_key, 'revoke'
    from unnest(coalesce(revoked_permissions, array[]::text[])) permission_key;
  end if;
end;
$$;

grant execute on function public.get_current_user_access_context() to authenticated;
grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_update_user(uuid, text, boolean, text, text[], text[], text) to authenticated;
