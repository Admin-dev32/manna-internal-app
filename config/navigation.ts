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
    href: '/leads',
    label: 'Leads',
    description: 'Seguimiento inicial de oportunidades comerciales.',
    icon: 'leads',
    permission: 'crm.view',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Base de relaciones activas y potenciales.',
    icon: 'clientes',
    permission: 'crm.view',
  },
  {
    href: '/cotizaciones',
    label: 'Cotizaciones',
    description: 'Propuestas y precios pendientes por formalizar.',
    icon: 'cotizaciones',
    permission: 'quotes.view',
  },
  {
    href: '/eventos',
    label: 'Eventos',
    description: 'Planeación operativa y calendario.',
    icon: 'eventos',
    permission: 'events.view',
  },
  {
    href: '/tareas',
    label: 'Tareas',
    description: 'Gestión de pendientes por equipo.',
    icon: 'tareas',
    permission: 'tasks.view',
  },
  {
    href: '/notificaciones',
    label: 'Notificaciones',
    description: 'Alertas y recordatorios internos.',
    icon: 'notificaciones',
    permission: 'notifications.view',
  },
  {
    href: '/comunicacion',
    label: 'Comunicación',
    description: 'Mensajes internos y contexto del equipo.',
    icon: 'comunicacion',
    permission: 'communication.view',
  },
  {
    href: '/empleados',
    label: 'Empleados',
    description: 'Estructura del equipo y perfiles.',
    icon: 'empleados',
    permission: 'employees.view',
  },
  {
    href: '/finanzas',
    label: 'Finanzas',
    description: 'Visión interna de indicadores financieros.',
    icon: 'finanzas',
    permission: 'finance.view',
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Control futuro de insumos y stock.',
    icon: 'inventario',
    permission: 'inventory.view',
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    description: 'Preferencias, permisos y parámetros del sistema.',
    icon: 'configuracion',
    permission: 'settings.view',
  },
];
