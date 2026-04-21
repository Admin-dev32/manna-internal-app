import type { OperationalProfile, SystemBaseRole, UserRole } from '@/types/auth';

export function normalizeRole(value: unknown): UserRole {
  if (value === 'owner' || value === 'manager' || value === 'empleado') {
    return value;
  }

  return 'empleado';
}

export function toSystemBaseRole(role: UserRole | unknown): SystemBaseRole {
  const normalized = normalizeRole(role);
  if (normalized === 'owner') return 'owner';
  if (normalized === 'manager') return 'supervisor';
  return 'employee';
}

export function fromSystemBaseRole(baseRole: SystemBaseRole | unknown): UserRole {
  if (baseRole === 'owner') return 'owner';
  if (baseRole === 'supervisor') return 'manager';
  return 'empleado';
}

export function normalizeOperationalProfile(value: unknown): OperationalProfile {
  if (value === 'team_leader' || value === 'assistant' || value === 'general_staff') {
    return value;
  }

  return 'general_staff';
}

export function canAccessRole(currentRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(currentRole);
}
