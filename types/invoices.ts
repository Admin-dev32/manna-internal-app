export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceRecord {
  id: string;
  quote_id: string;
  client_id: string | null;
  pre_event_id: string | null;
  event_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  deposit_amount: number | string | null;
  balance_due: number | string | null;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
  internal_notes: string | null;
  customer_snapshot: Record<string, unknown>;
  event_snapshot: Record<string, unknown>;
  financial_snapshot: Record<string, unknown>;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
