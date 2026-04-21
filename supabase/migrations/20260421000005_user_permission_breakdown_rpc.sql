-- USER ROLE MODEL CLEANUP PHASE C
-- Breakdown explicable de permisos efectivos por fuente para user management.

create or replace function public.admin_get_user_permission_breakdown(target_user_id uuid)
returns table (
  permission_key text,
  from_role boolean,
  from_operational_profile boolean,
  from_override_grant boolean,
  from_override_revoke boolean,
  is_effective boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assigned_role text;
  assigned_base_role text;
  assigned_operational_profile text := 'general_staff';
  known_permissions text[] := public.get_known_permissions();
  role_permissions text[] := array[]::text[];
  profile_permissions text[] := array[]::text[];
  granted_permissions text[] := array[]::text[];
  revoked_permissions text[] := array[]::text[];
begin
  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.';
  end if;

  select
    public.normalize_profile_role(p.role),
    public.map_profile_role_to_base_role(p.role),
    coalesce(uac.operational_profile, 'general_staff')
  into assigned_role, assigned_base_role, assigned_operational_profile
  from public.profiles p
  left join public.user_access_controls uac on uac.user_id = p.id
  where p.id = target_user_id;

  if assigned_role is null then
    return;
  end if;

  role_permissions := public.get_role_permissions(assigned_role);
  profile_permissions := public.get_operational_profile_permissions(assigned_base_role, assigned_operational_profile);

  select
    coalesce(array_agg(permission_key) filter (where effect = 'grant'), array[]::text[]),
    coalesce(array_agg(permission_key) filter (where effect = 'revoke'), array[]::text[])
  into granted_permissions, revoked_permissions
  from public.user_permission_overrides
  where user_id = target_user_id;

  return query
  select
    known.permission_key,
    (known.permission_key = any(role_permissions)) as from_role,
    (known.permission_key = any(profile_permissions)) as from_operational_profile,
    (known.permission_key = any(granted_permissions)) as from_override_grant,
    (known.permission_key = any(revoked_permissions)) as from_override_revoke,
    (
      (
        (assigned_role = 'owner')
        or (known.permission_key = any(role_permissions))
        or (known.permission_key = any(profile_permissions))
        or (known.permission_key = any(granted_permissions))
      )
      and not (known.permission_key = any(revoked_permissions))
    ) as is_effective
  from (
    select unnest(known_permissions) as permission_key
  ) known
  order by known.permission_key;
end;
$$;

grant execute on function public.admin_get_user_permission_breakdown(uuid) to authenticated;
