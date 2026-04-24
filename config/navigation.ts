import type { Route } from 'next';
import type { PermissionKey } from '@/types/auth';

export type NavigationIconKey =
  | 'dashboard'
  | 'leads'
  | 'clientes'
  | 'cotizaciones'
  | 'eventos'
  | 'tareas'
  | 'chat'
  | 'notificaciones'
  | 'comunicacion'
  | 'tickets'
  | 'empleados'
  | 'finanzas'
  | 'inventario'
  | 'configuracion';

export type NavigationSectionKey = 'comercial' | 'operacion' | 'coordinacion' | 'administracion';

export interface NavigationItem {
  href: Route;
  label: string;
  shortLabel?: string;
  description: string;
  icon: NavigationIconKey;
  permission: PermissionKey;
  section: NavigationSectionKey;
  matchPrefixes?: string[];
}

export const NAVIGATION_SECTION_LABELS: Record<NavigationSectionKey, string> = {
  comercial: 'Comercial',
  operacion: 'Operación',
  coordinacion: 'Coordinación',
  administracion: 'Administración',
};

export const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Inicio',
    description: 'Resumen operativo del negocio.',
    icon: 'dashboard',
    permission: 'dashboard.view',
    section: 'operacion',
  },
  {
    href: '/finanzas',
    label: 'Finanzas',
    description: 'Resumen financiero, defaults globales y control interno.',
    icon: 'finanzas',
    permission: 'finance.view',
    section: 'administracion',
    matchPrefixes: ['/finanzas'],
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    description: 'Área administrativa, permisos y user management.',
    icon: 'configuracion',
    permission: 'admin.users.manage',
    section: 'administracion',
    matchPrefixes: ['/configuracion'],
  },
  {
    href: '/leads',
    label: 'Leads',
    description: 'Pipeline comercial, detalle del lead y creación de cotizaciones.',
    icon: 'leads',
    permission: 'crm.view',
    section: 'comercial',
    matchPrefixes: ['/leads'],
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Clientes mínimos ya convertidos desde ventas aceptadas.',
    icon: 'clientes',
    permission: 'crm.view',
    section: 'comercial',
    matchPrefixes: ['/clientes'],
  },
  {
    href: '/cotizaciones',
    label: 'Cotizaciones',
    description: 'Propuestas comerciales, detalle y seguimiento de venta.',
    icon: 'cotizaciones',
    permission: 'quotes.view',
    section: 'comercial',
    matchPrefixes: ['/cotizaciones'],
  },
  {
    href: '/reservas',
    label: 'Reservas',
    description: 'Pre-eventos y reservas iniciales para operación.',
    icon: 'eventos',
    permission: 'events.view',
    section: 'operacion',
    matchPrefixes: ['/reservas'],
  },
  {
    href: '/eventos',
    label: 'Eventos',
    description: 'Eventos reales confirmados a partir de reservas listas.',
    icon: 'eventos',
    permission: 'events.view',
    section: 'operacion',
    matchPrefixes: ['/eventos'],
  },
  {
    href: '/tareas',
    label: 'Tareas',
    description: 'Trabajo operativo por evento, responsable, prioridad y estado.',
    icon: 'tareas',
    permission: 'tasks.view',
    section: 'operacion',
    matchPrefixes: ['/tareas'],
  },
  {
    href: '/chat',
    label: 'Chat',
    description: 'Canal global de equipo y conversación por evento.',
    icon: 'chat',
    permission: 'chat.view',
    section: 'coordinacion',
    matchPrefixes: ['/chat'],
  },
  {
    href: '/notificaciones',
    label: 'Notificaciones',
    description: 'Recordatorios internos y alertas suaves para seguimiento comercial y operativo.',
    icon: 'notificaciones',
    permission: 'notifications.view',
    section: 'coordinacion',
    matchPrefixes: ['/notificaciones'],
  },
  {
    href: '/comunicacion',
    label: 'Comunicación',
    description: 'Canales internos de coordinación y seguimiento operativo.',
    icon: 'comunicacion',
    permission: 'communication.view',
    section: 'coordinacion',
    matchPrefixes: ['/comunicacion'],
  },
  {
    href: '/oficina-solicitudes',
    label: 'Main office',
    description: 'Inbox de tickets/solicitudes internas del equipo.',
    icon: 'tickets',
    permission: 'internal_tickets.manage',
    section: 'coordinacion',
    matchPrefixes: ['/oficina-solicitudes'],
  },
  {
    href: '/empleados',
    label: 'Empleados',
    description: 'Asignaciones, reportes operativos y panel diario del staff.',
    icon: 'empleados',
    permission: 'employees.view',
    section: 'operacion',
    matchPrefixes: ['/empleados'],
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Materiales, stock actual y necesidades ligadas a eventos.',
    icon: 'inventario',
    permission: 'inventory.view',
    section: 'operacion',
    matchPrefixes: ['/inventario'],
  },
];

export const mainNavigationItems = navigationItems;
