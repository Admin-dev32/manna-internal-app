import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeOperationalProfile, toSystemBaseRole } from '@/lib/auth/roles';
import type { PermissionKey } from '@/types/auth';
import type { ManagedUserDetail, ManagedUserListItem, ManagedUserPermissionBreakdownItem } from '@/types/user-management';

function normalizePermissionList(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((permission): permission is PermissionKey => typeof permission === 'string') as PermissionKey[];
}

function mapManagedUserListItem(value: Record<string, unknown>): ManagedUserListItem {
  return {
    id: String(value.id),
    full_name: typeof value.full_name === 'string' ? value.full_name : null,
    email: typeof value.email === 'string' ? value.email : 'sin-correo@manna.local',
    role: value.role === 'owner' || value.role === 'manager' || value.role === 'empleado' ? value.role : 'empleado',
    base_role: value.base_role === 'owner' || value.base_role === 'supervisor' || value.base_role === 'employee'
      ? value.base_role
      : toSystemBaseRole(value.role),
    operational_profile: normalizeOperationalProfile(value.operational_profile),
    is_active: value.is_active === true,
    is_site_owner: value.is_site_owner === true,
    invitation_pending: value.invitation_pending === true,
    can_resend_invitation: value.can_resend_invitation === true,
    can_delete_user: value.can_delete_user === true,
    last_sign_in_at: typeof value.last_sign_in_at === 'string' ? value.last_sign_in_at : null,
    admin_notes: typeof value.admin_notes === 'string' ? value.admin_notes : null,
    granted_permissions: normalizePermissionList(value.granted_permissions),
    revoked_permissions: normalizePermissionList(value.revoked_permissions),
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
  };
}

function mapManagedUserDetail(value: Record<string, unknown>): ManagedUserDetail {
  return {
    ...mapManagedUserListItem(value),
    effective_permissions: normalizePermissionList(value.effective_permissions),
    permission_breakdown: [],
  };
}

function normalizePermissionBreakdownList(value: unknown): ManagedUserPermissionBreakdownItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = item as Record<string, unknown>;
      const permissionKey = String(record.permission_key ?? '');
      if (!permissionKey) return null;

      return {
        permission_key: permissionKey as ManagedUserPermissionBreakdownItem['permission_key'],
        from_role: record.from_role === true,
        from_operational_profile: record.from_operational_profile === true,
        from_override_grant: record.from_override_grant === true,
        from_override_revoke: record.from_override_revoke === true,
        is_effective: record.is_effective === true,
      } satisfies ManagedUserPermissionBreakdownItem;
    })
    .filter((item): item is ManagedUserPermissionBreakdownItem => Boolean(item));
}

export async function getManagedUsers(searchTerm?: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [] as ManagedUserListItem[];
  }

  const { data, error } = await supabase.rpc('admin_list_users', {
    search_term: searchTerm?.trim() ? searchTerm.trim() : null,
  });

  if (error || !Array.isArray(data)) {
    return [] as ManagedUserListItem[];
  }

  return data.map((item) => mapManagedUserListItem(item as Record<string, unknown>));
}

export async function getManagedUserDetail(userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const [{ data: detailData, error: detailError }, { data: breakdownData, error: breakdownError }] = await Promise.all([
    supabase.rpc('admin_get_user_detail', {
      target_user_id: userId,
    }),
    supabase.rpc('admin_get_user_permission_breakdown', {
      target_user_id: userId,
    }),
  ]);

  if (detailError || !Array.isArray(detailData) || detailData.length === 0) {
    return null;
  }

  const mappedDetail = mapManagedUserDetail(detailData[0] as Record<string, unknown>);
  const mappedBreakdown = breakdownError ? [] : normalizePermissionBreakdownList(breakdownData);
  const effectiveFromBreakdown = mappedBreakdown.filter((item) => item.is_effective).map((item) => item.permission_key);

  return {
    ...mappedDetail,
    permission_breakdown: mappedBreakdown,
    effective_permissions: mappedBreakdown.length > 0 ? effectiveFromBreakdown : mappedDetail.effective_permissions,
  };
}
