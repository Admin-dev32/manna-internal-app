import { ROLE_PERMISSIONS } from '@/config/roles';
import { PERMISSION_KEYS } from '@/types/auth';
import type { AppUser, PermissionKey, UserRole } from '@/types/auth';

function uniquePermissions(permissions: PermissionKey[]) {
  return [...new Set(permissions)];
}

export function getRolePermissions(role: UserRole) {
  if (role === 'owner') {
    return [...PERMISSION_KEYS];
  }

  return ROLE_PERMISSIONS[role];
}

export function getEffectivePermissions(subject: UserRole | Pick<AppUser, 'rol' | 'permissions'>) {
  if (typeof subject === 'string') {
    return getRolePermissions(subject);
  }

  if (subject.rol === 'owner') {
    return [...PERMISSION_KEYS];
  }

  return uniquePermissions(subject.permissions.length > 0 ? subject.permissions : getRolePermissions(subject.rol));
}

export function hasPermission(subject: UserRole | Pick<AppUser, 'rol' | 'permissions'>, permission: PermissionKey) {
  if (typeof subject === 'string') {
    return getRolePermissions(subject).includes(permission);
  }

  return getEffectivePermissions(subject).includes(permission);
}

export function hasAnyPermission(subject: UserRole | Pick<AppUser, 'rol' | 'permissions'>, permissions: PermissionKey[]) {
  const effectivePermissions = getEffectivePermissions(subject);
  return permissions.some((permission) => effectivePermissions.includes(permission));
}
