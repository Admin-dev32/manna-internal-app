import type { PermissionKey } from '@/types/auth';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'Dashboard',
  'crm.view': 'CRM y clientes',
  'quotes.view': 'Cotizaciones',
  'events.view': 'Reservas y eventos',
  'tasks.view': 'Tareas',
  'notifications.view': 'Notificaciones',
  'communication.view': 'Comunicación',
  'employees.view': 'Empleados',
  'finance.view': 'Finanzas',
  'inventory.view': 'Inventario',
  'settings.view': 'Configuración general',
  'audit.view': 'Auditoría',
  'admin.users.manage': 'Administrar usuarios',
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'dashboard.view': 'Ver el tablero principal de operación interna.',
  'crm.view': 'Entrar a leads, clientes y flujo comercial base.',
  'quotes.view': 'Consultar y trabajar cotizaciones.',
  'events.view': 'Ver reservas, pre-eventos y eventos.',
  'tasks.view': 'Acceso al módulo de tareas.',
  'notifications.view': 'Acceso al centro de notificaciones.',
  'communication.view': 'Acceso al área de comunicación interna.',
  'employees.view': 'Acceso al módulo de empleados cuando exista.',
  'finance.view': 'Ver y editar secciones financieras habilitadas.',
  'inventory.view': 'Acceso al módulo de inventario.',
  'settings.view': 'Acceso a configuración avanzada del sistema.',
  'audit.view': 'Acceso a auditoría cuando se implemente.',
  'admin.users.manage': 'Gestionar usuarios, roles y overrides de permisos.',
};

export const USER_MANAGEMENT_OVERRIDE_OPTIONS: PermissionKey[] = [
  'finance.view',
  'crm.view',
  'quotes.view',
  'events.view',
  'inventory.view',
  'tasks.view',
  'notifications.view',
  'settings.view',
  'admin.users.manage',
  'audit.view',
];
