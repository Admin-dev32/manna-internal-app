drop function if exists public.admin_list_users(text);
create function public.admin_list_users(search_term text default null)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
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
    p.role,
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
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, au.invited_at, au.email_confirmed_at, au.last_sign_in_at, p.created_at, p.updated_at, uac.updated_at
  order by coalesce(uac.is_site_owner, false) desc, lower(coalesce(p.full_name, au.email, p.id::text)) asc;
$$;

drop function if exists public.admin_get_user_detail(uuid);
create function public.admin_get_user_detail(target_user_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
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
    p.role,
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
  group by p.id, p.full_name, au.email, p.role, p.is_active, uac.is_site_owner, uac.admin_notes, au.invited_at, au.email_confirmed_at, au.last_sign_in_at, p.created_at, p.updated_at, uac.updated_at;
$$;

grant execute on function public.admin_list_users(text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
