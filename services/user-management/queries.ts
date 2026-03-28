import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PermissionKey } from '@/types/auth';
import type { ManagedUserDetail, ManagedUserListItem } from '@/types/user-management';

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
    is_active: value.is_active === true,
    is_site_owner: value.is_site_owner === true,
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
  };
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

  const { data, error } = await supabase.rpc('admin_get_user_detail', {
    target_user_id: userId,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return mapManagedUserDetail(data[0] as Record<string, unknown>);
}
