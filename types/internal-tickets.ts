export const INTERNAL_TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;
export const INTERNAL_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const INTERNAL_TICKET_CATEGORIES = [
  'approval',
  'missing_material',
  'event_issue',
  'urgent_purchase',
  'operational_incident',
  'general_request',
] as const;

export type InternalTicketStatus = (typeof INTERNAL_TICKET_STATUSES)[number];
export type InternalTicketPriority = (typeof INTERNAL_TICKET_PRIORITIES)[number];
export type InternalTicketCategory = (typeof INTERNAL_TICKET_CATEGORIES)[number];

export interface InternalTicketRecord {
  id: string;
  subject: string;
  description: string;
  status: InternalTicketStatus;
  priority: InternalTicketPriority;
  category: InternalTicketCategory;
  event_id: string | null;
  created_by: string;
  assigned_to: string | null;
  office_response: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalTicketView extends InternalTicketRecord {
  created_by_name: string | null;
  assigned_to_name: string | null;
  closed_by_name: string | null;
  event_label: string | null;
}
