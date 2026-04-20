import type { InternalTicketCategory, InternalTicketPriority, InternalTicketStatus } from '@/types/internal-tickets';

export const INTERNAL_TICKET_STATUS_LABELS: Record<InternalTicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  closed: 'Cerrado',
};

export const INTERNAL_TICKET_PRIORITY_LABELS: Record<InternalTicketPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const INTERNAL_TICKET_CATEGORY_LABELS: Record<InternalTicketCategory, string> = {
  approval: 'Necesito aprobación',
  missing_material: 'Falta material',
  event_issue: 'Problema en evento',
  urgent_purchase: 'Compra urgente',
  operational_incident: 'Incidencia operativa',
  general_request: 'Solicitud general',
};
