import {
  Bell,
  BriefcaseBusiness,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import type { PermissionKey } from '@/types/auth';

export interface NavigationItem {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  permission: PermissionKey;
}

export const navigationItems: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Resumen operativo del negocio.',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
  },
  {
    href: '/leads',
    label: 'Leads',
    description: 'Seguimiento inicial de oportunidades comerciales.',
    icon: BriefcaseBusiness,
    permission: 'crm.view',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Base de relaciones activas y potenciales.',
    icon: Users,
    permission: 'crm.view',
  },
  {
    href: '/cotizaciones',
    label: 'Cotizaciones',
    description: 'Propuestas y precios pendientes por formalizar.',
    icon: FileText,
    permission: 'quotes.view',
  },
  {
    href: '/eventos',
    label: 'Eventos',
    description: 'Planeación operativa y calendario.',
    icon: CalendarRange,
    permission: 'events.view',
  },
  {
    href: '/tareas',
    label: 'Tareas',
    description: 'Gestión de pendientes por equipo.',
    icon: ClipboardList,
    permission: 'tasks.view',
  },
  {
    href: '/notificaciones',
    label: 'Notificaciones',
    description: 'Alertas y recordatorios internos.',
    icon: Bell,
    permission: 'notifications.view',
  },
  {
    href: '/comunicacion',
    label: 'Comunicación',
    description: 'Mensajes internos y contexto del equipo.',
    icon: MessageSquareText,
    permission: 'communication.view',
  },
  {
    href: '/empleados',
    label: 'Empleados',
    description: 'Estructura del equipo y perfiles.',
    icon: ShieldCheck,
    permission: 'employees.view',
  },
  {
    href: '/finanzas',
    label: 'Finanzas',
    description: 'Visión interna de indicadores financieros.',
    icon: WalletCards,
    permission: 'finance.view',
  },
  {
    href: '/inventario',
    label: 'Inventario',
    description: 'Control futuro de insumos y stock.',
    icon: Package,
    permission: 'inventory.view',
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    description: 'Preferencias, permisos y parámetros del sistema.',
    icon: Settings,
    permission: 'settings.view',
  },
];
