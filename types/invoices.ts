export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;
export const INVOICE_SOURCE_TYPES = ['quote', 'pre_event', 'event', 'manual'] as const;
export const INVOICE_EMAIL_PURPOSES = ['invoice_delivery', 'invoice_reminder'] as const;
export const INVOICE_EMAIL_DELIVERY_STATUSES = ['sent', 'failed'] as const;
export const INVOICE_PAYMENT_METHODS = ['stripe', 'zelle', 'cash', 'card', 'bank_transfer', 'manual_adjustment', 'other'] as const;
export const INVOICE_PAYMENT_SOURCE_TYPES = ['webhook', 'manual', 'import', 'internal_api'] as const;
export const INVOICE_PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'reversed', 'refunded'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceSourceType = (typeof INVOICE_SOURCE_TYPES)[number];
export type InvoiceEmailPurpose = (typeof INVOICE_EMAIL_PURPOSES)[number];
export type InvoiceEmailDeliveryStatus = (typeof INVOICE_EMAIL_DELIVERY_STATUSES)[number];
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];
export type InvoicePaymentSourceType = (typeof INVOICE_PAYMENT_SOURCE_TYPES)[number];
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export interface InvoiceRecord {
  id: string;
  quote_id: string | null;
  source_type: InvoiceSourceType;
  source_id: string | null;
  manual_title: string | null;
  manual_description: string | null;
  manual_customer_name: string | null;
  manual_customer_email: string | null;
  client_id: string | null;
  pre_event_id: string | null;
  event_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  taxable_amount: number | string;
  non_taxable_amount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  tax_jurisdiction: string | null;
  tax_region: string | null;
  tax_exemption_reason: string | null;
  sales_tax_payable_account_id: string | null;
  deposit_amount: number | string | null;
  balance_due: number | string | null;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
  internal_notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  customer_snapshot: Record<string, unknown>;
  event_snapshot: Record<string, unknown>;
  financial_snapshot: Record<string, unknown>;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateManualInvoiceInput {
  clientId?: string | null;
  manualCustomerName?: string | null;
  manualCustomerEmail?: string | null;
  manualTitle: string;
  manualDescription?: string | null;
  subtotal: number;
  discountAmount?: number | null;
  depositAmount?: number | null;
  dueAt?: string | null;
  notes?: string | null;
}

export interface ManualInvoiceClientOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  label: string;
  searchText: string;
}

export interface SendInvoiceEmailInput {
  purpose?: InvoiceEmailPurpose;
  recipientOverride?: string | null;
  subjectOverride?: string | null;
}

export interface InvoiceEmailDeliveryRecord {
  id: string;
  invoice_id: string;
  purpose: InvoiceEmailPurpose;
  sent_to: string;
  subject: string;
  provider: string | null;
  provider_message_id: string | null;
  status: InvoiceEmailDeliveryStatus;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface InvoicePaymentRecord {
  id: string;
  invoice_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: InvoicePaymentMethod;
  provider: string | null;
  provider_payment_id: string | null;
  reference: string | null;
  source_type: InvoicePaymentSourceType;
  status: InvoicePaymentStatus;
  fee_amount: number | string;
  net_amount: number | string;
  deposited_to_account_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
