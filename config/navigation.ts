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
    href: '/leads',
    label: 'Leads',
    description: 'Pipeline comercial, detalle del lead y creación de cotizaciones.',
    icon: 'leads',
    permission: 'crm.view',
    matchPrefixes: ['/leads'],
  },
  {
    href: '/cotizaciones',
    label: 'Cotizaciones',
    description: 'Cotizaciones, clientes derivados y reservas iniciales.',
    icon: 'cotizaciones',
    permission: 'quotes.view',
    matchPrefixes: ['/cotizaciones', '/clientes', '/reservas'],
  },
];
