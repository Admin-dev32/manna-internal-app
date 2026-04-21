-- USER ROLE MODEL CLEANUP PHASE B
-- Presets por combinación (rol base + perfil operativo) y resolución efectiva.

create or replace function public.get_operational_profile_permissions(target_base_role text, target_operational_profile text)
returns text[]
language sql
stable
as $$
  select case lower(coalesce(target_base_role, ''))
    when 'employee' then case lower(coalesce(target_operational_profile, 'general_staff'))
      when 'team_leader' then array['events.view', 'inventory.view', 'inventory.prepare']::text[]
      when 'assistant' then array['events.view', 'inventory.view']::text[]
      else array[]::text[]
    end
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
  assigned_base_role text;
  assigned_operational_profile text := 'general_staff';
  profile_permissions text[] := array[]::text[];
  granted_permissions text[] := array[]::text[];
  revoked_permissions text[] := array[]::text[];
  known_permissions text[] := public.get_known_permissions();
begin
  select
    public.normalize_profile_role(p.role),
    public.map_profile_role_to_base_role(p.role),
    coalesce(uac.operational_profile, 'general_staff')
  into assigned_role, assigned_base_role, assigned_operational_profile
  from public.profiles p
  left join public.user_access_controls uac on uac.user_id = p.id
  where p.id = target_user_id
    and p.is_active = true;

  if assigned_role is null then
    return array[]::text[];
  end if;

  if assigned_role = 'owner' then
    return known_permissions;
  end if;

  profile_permissions := public.get_operational_profile_permissions(assigned_base_role, assigned_operational_profile);

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
      select unnest(profile_permissions)
      union
      select unnest(granted_permissions)
    ) permission_union
    where permission_key = any(known_permissions)
      and not (permission_key = any(revoked_permissions))
  );
end;
$$;
