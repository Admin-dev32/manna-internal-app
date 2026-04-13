import type { PermissionKey, PermissionOverrideEffect, UserRole } from '@/types/auth';

export interface ManagedUserListItem {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_site_owner: boolean;
  invitation_pending: boolean;
  can_resend_invitation: boolean;
  can_delete_user: boolean;
  last_sign_in_at: string | null;
  admin_notes: string | null;
  granted_permissions: PermissionKey[];
  revoked_permissions: PermissionKey[];
  created_at: string;
  updated_at: string;
}

export interface ManagedUserDetail extends ManagedUserListItem {
  effective_permissions: PermissionKey[];
}

export interface ManagedUserOverrideRecord {
  permission_key: PermissionKey;
  effect: PermissionOverrideEffect;
}

export interface UserManagementActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}
