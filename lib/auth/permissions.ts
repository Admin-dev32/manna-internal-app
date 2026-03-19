import { ROLE_PERMISSIONS } from '@/config/roles';
import type { PermissionKey, UserRole } from '@/types/auth';

export function hasPermission(role: UserRole, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
