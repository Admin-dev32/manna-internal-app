export const EVENT_STATUSES = ['programado', 'en_operacion', 'completado', 'cancelado'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface EventRecord {
  id: string;
  client_id: string;
  lead_id: string | null;
  source_quote_id: string;
  source_pre_event_id: string;
  event_date: string;
  event_time: string;
  location: string | null;
  event_type: string | null;
  booked_service: string;
  guest_count: number | null;
  operational_notes: string | null;
  status: EventStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventFinanceSnapshot {
  grossRevenue: number;
  taxReserve: number;
  salesCommission: number;
  totalExtraExpenses: number;
  netProfit: number;
}
