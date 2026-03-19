export const USER_ROLES = ['owner', 'manager', 'empleado'] as const;
export const USER_STATUSES = ['activo', 'inactivo'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export type PermissionKey =
  | 'dashboard.view'
  | 'crm.view'
  | 'quotes.view'
  | 'events.view'
  | 'tasks.view'
  | 'notifications.view'
  | 'communication.view'
  | 'employees.view'
  | 'finance.view'
  | 'inventory.view'
  | 'settings.view'
  | 'audit.view';

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  estado: UserStatus;
}

export interface SessionContext {
  user: AppUser | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
}

export interface ProfileRecord {
  id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}
