import type { OperationalProfile, PermissionKey, SystemBaseRole } from '@/types/auth';

export const BASE_ROLE_LABELS: Record<SystemBaseRole, string> = {
  owner: 'Owner',
  supervisor: 'Supervisor',
  employee: 'Employee',
};

export const OPERATIONAL_PROFILE_LABELS: Record<OperationalProfile, string> = {
  team_leader: 'Team Leader',
  assistant: 'Assistant',
  general_staff: 'General Staff',
};

const EMPLOYEE_OPERATIONAL_PROFILE_PRESETS: Record<OperationalProfile, PermissionKey[]> = {
  team_leader: ['events.view', 'inventory.view', 'inventory.prepare'],
  assistant: ['events.view', 'inventory.view'],
  general_staff: [],
};

export function getOperationalProfilePresetPermissions(baseRole: SystemBaseRole, operationalProfile: OperationalProfile): PermissionKey[] {
  if (baseRole !== 'employee') {
    return [];
  }

  return EMPLOYEE_OPERATIONAL_PROFILE_PRESETS[operationalProfile];
}
