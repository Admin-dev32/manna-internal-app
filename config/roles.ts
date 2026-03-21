import type { PermissionKey, UserRole } from '@/types/auth';

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Propietario',
  manager: 'Gerencia',
  empleado: 'Empleado',
};

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  owner: [
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'notifications.view',
    'communication.view',
    'employees.view',
    'finance.view',
    'inventory.view',
    'settings.view',
    'audit.view',
  ],
  manager: [
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'notifications.view',
    'communication.view',
    'employees.view',
    'finance.view',
    'inventory.view',
  ],
  empleado: [
    'dashboard.view',
    'tasks.view',
    'notifications.view',
    'communication.view',
  ],
};
