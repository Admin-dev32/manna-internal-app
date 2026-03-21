import type { ReactNode } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  CalendarRange,
  ClipboardList,
  FileText,
  MessageSquareText,
  Package,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

export interface ModuleDefinition {
  title: string;
  description: string;
  status: string;
  primaryAction?: string;
  secondaryAction?: string;
  icon: ReactNode;
  bullets: string[];
}

export const moduleDefinitions: Record<string, ModuleDefinition> = {
  leads: {
    title: 'Leads',
    description: 'Base preparada para capturar, segmentar y convertir oportunidades comerciales.',
    status: 'Pendiente de implementar el flujo CRM.',
    primaryAction: 'Crear lead',
    secondaryAction: 'Importar leads',
    icon: <BriefcaseBusiness className="size-5" />,
    bullets: ['Pipeline comercial', 'Asignación por responsable', 'Historial de actividad'],
  },
  clientes: {
    title: 'Clientes',
    description: 'Espacio listo para consolidar cuentas, contactos y seguimiento postventa.',
    status: 'Pendiente de implementar la gestión de clientes.',
    primaryAction: 'Nuevo cliente',
    secondaryAction: 'Ver segmentos',
    icon: <Users className="size-5" />,
    bullets: ['Perfil 360°', 'Relaciones comerciales', 'Notas internas'],
  },
  cotizaciones: {
    title: 'Cotizaciones',
    description: 'Preparado para generar propuestas, controlar versiones y aprobar precios.',
    status: 'Pendiente de implementar el flujo de cotización.',
    primaryAction: 'Nueva cotización',
    secondaryAction: 'Ver plantillas',
    icon: <FileText className="size-5" />,
    bullets: ['Versionado', 'Aprobaciones', 'Conversión a evento'],
  },
  eventos: {
    title: 'Eventos',
    description: 'Base visual para coordinar calendario, operación y responsables por evento.',
    status: 'Pendiente de implementar la gestión operativa de eventos.',
    primaryAction: 'Programar evento',
    secondaryAction: 'Ver calendario',
    icon: <CalendarRange className="size-5" />,
    bullets: ['Cronograma', 'Recursos asignados', 'Checklist operativo'],
  },
  tareas: {
    title: 'Tareas',
    description: 'Preparado para administrar trabajo interno, seguimiento y prioridades del equipo.',
    status: 'Pendiente de implementar el módulo de tareas.',
    primaryAction: 'Crear tarea',
    secondaryAction: 'Ver pendientes',
    icon: <ClipboardList className="size-5" />,
    bullets: ['Prioridades', 'Responsables', 'Vencimientos'],
  },
  notificaciones: {
    title: 'Notificaciones',
    description: 'Espacio listo para alertas del sistema, recordatorios y avisos internos.',
    status: 'Pendiente de implementar el centro de notificaciones.',
    primaryAction: 'Nueva alerta',
    secondaryAction: 'Configurar preferencias',
    icon: <Bell className="size-5" />,
    bullets: ['Alertas internas', 'Avisos contextuales', 'Preferencias por rol'],
  },
  comunicacion: {
    title: 'Comunicación',
    description: 'Preparado para conversaciones internas, contexto por módulo y menciones futuras.',
    status: 'Pendiente de implementar la comunicación interna.',
    primaryAction: 'Nuevo mensaje',
    secondaryAction: 'Ver hilos',
    icon: <MessageSquareText className="size-5" />,
    bullets: ['Canales internos', 'Comentarios por entidad', 'Menciones @usuario'],
  },
  empleados: {
    title: 'Empleados',
    description: 'Base lista para perfiles, roles, permisos y estructura del equipo.',
    status: 'Pendiente de implementar el módulo de empleados.',
    primaryAction: 'Agregar empleado',
    secondaryAction: 'Ver roles',
    icon: <ShieldCheck className="size-5" />,
    bullets: ['Perfiles internos', 'Historial', 'Roles y accesos'],
  },
  finanzas: {
    title: 'Finanzas',
    description: 'Preparado para control interno de métricas, gastos e indicadores clave.',
    status: 'Pendiente de implementar las finanzas internas.',
    primaryAction: 'Registrar movimiento',
    secondaryAction: 'Ver reportes',
    icon: <WalletCards className="size-5" />,
    bullets: ['Resumen financiero', 'Egresos e ingresos', 'Cortes y reportes'],
  },
  inventario: {
    title: 'Inventario',
    description: 'Base lista para materiales, stock y trazabilidad operativa futura.',
    status: 'Pendiente de implementar el inventario.',
    primaryAction: 'Registrar insumo',
    secondaryAction: 'Ver stock',
    icon: <Package className="size-5" />,
    bullets: ['Stock actual', 'Movimientos', 'Alertas por mínimos'],
  },
  configuracion: {
    title: 'Configuración',
    description: 'Base para parámetros globales, permisos, catálogos y controles del sistema.',
    status: 'Pendiente de implementar la configuración avanzada.',
    primaryAction: 'Editar ajustes',
    secondaryAction: 'Ver permisos',
    icon: <Settings className="size-5" />,
    bullets: ['Permisos granulares', 'Catálogos base', 'Ajustes operativos'],
  },
};
