import type { Route } from 'next';
import type { PermissionKey } from '@/types/auth';

export type NavigationIconKey =
  | 'dashboard'
  | 'leads'
  | 'clientes'
  | 'cotizaciones'
  | 'eventos'
  | 'tareas'
  | 'notificaciones'
  | 'comunicacion'
  | 'empleados'
  | 'finanzas'
  | 'inventario'
  | 'configuracion';

export interface NavigationItem {
  href: Route;
  label: string;
  description: string;
  icon: NavigationIconKey;
  permission: PermissionKey;
  matchPrefixes?: string[];
}

export const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Resumen operativo del negocio.',
    icon: 'dashboard',
    permission: 'dashboard.view',
  },
  {
    href: '/finanzas',
    label: 'Finanzas',
    description: 'Resumen financiero, defaults globales y control interno.',
    icon: 'finanzas',
    permission: 'finance.view',
    matchPrefixes: ['/finanzas'],
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    description: 'Área administrativa, permisos y user management.',
    icon: 'configuracion',
    permission: 'admin.users.manage',
    matchPrefixes: ['/configuracion'],
  },
  {
    href: '/leads',
    label: 'Leads',
    description: 'Pipeline comercial, detalle del lead y creación de cotizaciones.',
    icon: 'leads',
    permission: 'crm.view',
    matchPrefixes: ['/leads'],
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Clientes mínimos ya convertidos desde ventas aceptadas.',
    icon: 'clientes',
    permission: 'crm.view',
    matchPrefixes: ['/clientes'],
  },
  {
    href: '/cotizaciones',
    label: 'Cotizaciones',
    description: 'Propuestas comerciales, detalle y seguimiento de venta.',
    icon: 'cotizaciones',
    permission: 'quotes.view',
    matchPrefixes: ['/cotizaciones'],
  },
  {
    href: '/reservas',
    label: 'Reservas',
    description: 'Pre-eventos y reservas iniciales para operación.',
    icon: 'eventos',
    permission: 'events.view',
    matchPrefixes: ['/reservas'],
  },
  {
    href: '/eventos',
    label: 'Eventos',
    description: 'Eventos reales confirmados a partir de reservas listas.',
    icon: 'eventos',
    permission: 'events.view',
    matchPrefixes: ['/eventos'],
  },
  {
    href: '/tareas',
    label: 'Tareas',
    description: 'Trabajo operativo por evento, responsable, prioridad y estado.',
    icon: 'tareas',
    permission: 'tasks.view',
    matchPrefixes: ['/tareas'],
  },
  {
    href: '/notificaciones',
    label: 'Notificaciones',
    description: 'Recordatorios internos y alertas suaves para seguimiento comercial y operativo.',
    icon: 'notificaciones',
    permission: 'notifications.view',
    matchPrefixes: ['/notificaciones'],
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Materiales, stock actual y necesidades ligadas a eventos.',
    icon: 'inventario',
    permission: 'inventory.view',
    matchPrefixes: ['/inventario'],
  },
];

export const mainNavigationItems = navigationItems;
