import { ROLE_PERMISSIONS } from '@/config/roles';
import { getOperationalProfilePresetPermissions } from '@/config/user-access-presets';
import { PERMISSION_KEYS } from '@/types/auth';
import type { AppUser, PermissionKey, UserRole } from '@/types/auth';
import { normalizeOperationalProfile, toSystemBaseRole } from '@/lib/auth/roles';

function uniquePermissions(permissions: PermissionKey[]) {
  return [...new Set(permissions)];
}

export function getRolePermissions(role: UserRole) {
  if (role === 'owner') {
    return [...PERMISSION_KEYS];
  }

  return ROLE_PERMISSIONS[role];
}

export function getEffectivePermissions(subject: UserRole | Pick<AppUser, 'rol' | 'permissions' | 'baseRole' | 'operationalProfile'>) {
  if (typeof subject === 'string') {
    return getRolePermissions(subject);
  }

  if (subject.rol === 'owner') {
    return [...PERMISSION_KEYS];
  }

  if (subject.permissions.length > 0) {
    return uniquePermissions(subject.permissions);
  }

  const baseRole = subject.baseRole ?? toSystemBaseRole(subject.rol);
  const operationalProfile = normalizeOperationalProfile(subject.operationalProfile);
  return uniquePermissions([...getRolePermissions(subject.rol), ...getOperationalProfilePresetPermissions(baseRole, operationalProfile)]);
}

export function hasPermission(subject: UserRole | Pick<AppUser, 'rol' | 'permissions' | 'baseRole' | 'operationalProfile'>, permission: PermissionKey) {
  if (typeof subject === 'string') {
    return getRolePermissions(subject).includes(permission);
  }

  return getEffectivePermissions(subject).includes(permission);
}

export function hasAnyPermission(subject: UserRole | Pick<AppUser, 'rol' | 'permissions' | 'baseRole' | 'operationalProfile'>, permissions: PermissionKey[]) {
  const effectivePermissions = getEffectivePermissions(subject);
  return permissions.some((permission) => effectivePermissions.includes(permission));
}
