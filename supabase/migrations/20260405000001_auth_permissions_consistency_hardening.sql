-- AUTH + PERMISSIONS consistency hardening.
-- Objetivo: mantener alineado el catálogo de permisos entre app (types/config) y DB (RLS + RPC).
-- No cambia arquitectura: solo consolida definiciones canónicas y endurece resolución efectiva.

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
  select case target_role
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
    when 'empleado' then array[
      'dashboard.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view'
    ]::text[]
    else array[]::text[]
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
  select role
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
