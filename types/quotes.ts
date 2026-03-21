export const QUOTE_STATUSES = ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface QuoteRecord {
  id: string;
  lead_id: string;
  status: QuoteStatus;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  promotion_note: string | null;
  total_amount: number | string;
  expected_deposit: number | string | null;
  estimated_balance: number | string | null;
  notes: string | null;
  sent_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteLeadSummary {
  id: string;
  full_name: string;
  status: string;
  quoted_total: number | string | null;
}
