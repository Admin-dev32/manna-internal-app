export const PRE_EVENT_STATUSES = ['pendiente', 'confirmado', 'en_preparacion'] as const;

export type PreEventStatus = (typeof PRE_EVENT_STATUSES)[number];

export interface PreEventRecord {
  id: string;
  client_id: string;
  lead_id: string | null;
  source_quote_id: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  location: string | null;
  event_type: string | null;
  booked_service: string | null;
  confirmed_guests: number | null;
  initial_operations_notes: string | null;
  status: PreEventStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
