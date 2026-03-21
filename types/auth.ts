export const USER_ROLES = ['owner', 'manager', 'empleado'] as const;
export const USER_STATUSES = ['activo', 'inactivo'] as const;
export const PERMISSION_KEYS = [
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
  'admin.users.manage',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  estado: UserStatus;
  permissions: PermissionKey[];
  isSiteOwner: boolean;
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

export interface CurrentUserAccessContext {
  user_id: string;
  role: UserRole;
  is_active: boolean;
  is_site_owner: boolean;
  permissions: PermissionKey[];
}

export type PermissionOverrideEffect = 'grant' | 'revoke';
