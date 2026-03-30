import type { UserRole } from '@/types/auth';

export function normalizeRole(value: unknown): UserRole {
  if (value === 'owner' || value === 'manager' || value === 'empleado') {
    return value;
  }

  return 'empleado';
}

export function canAccessRole(currentRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(currentRole);
}
