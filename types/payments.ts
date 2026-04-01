export const PAYMENT_MODES = ['deposit', 'full'] as const;
export const PAYMENT_SOURCE_RECORD_TYPES = ['pre_event', 'quote'] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentSourceRecordType = (typeof PAYMENT_SOURCE_RECORD_TYPES)[number];

export interface PaymentLinkRecord {
  id: string;
  source_record_type: PaymentSourceRecordType;
  source_record_id: string;
  payment_mode: PaymentMode;
  currency: string;
  total_event_amount: number | string;
  amount_to_charge: number | string;
  balance_due: number | string;
  external_provider: string;
  external_payment_link_id: string | null;
  external_url: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InternalPaymentLinkApiPayload {
  mode: PaymentMode;
  currency: 'usd';
  amountToCharge: string;
  totalEventAmount: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  event: {
    date: string;
    startTime: string;
    address: string;
    barName: string;
    servings: string;
  };
  metadata: Record<string, string>;
}
