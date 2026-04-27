import type { InvoiceRecord } from '@/types/invoices';
import type { PaymentLinkRecord } from '@/types/payments';
import type { EventStatus } from '@/types/events';
import type { PreEventStatus } from '@/types/pre-events';

export type PaymentStatusTone = 'success' | 'warning' | 'info' | 'neutral' | 'danger';

export type PaymentStatus =
  | 'paid_in_full'
  | 'deposit_paid_balance_pending'
  | 'reserved_not_paid_in_full'
  | 'payment_pending'
  | 'cancelled_or_inactive'
  | 'unknown';

export interface PaymentStatusResult {
  status: PaymentStatus;
  label: string;
  tone: PaymentStatusTone;
  totalExpected: number | null;
  amountPaid: number | null;
  amountDue: number | null;
  reasons: string[];
}

export interface PaymentStatusInput {
  preEventStatus?: PreEventStatus | null;
  eventStatus?: EventStatus | null;
  quoteTotalAmount?: number | string | null;
  expectedDeposit?: number | string | null;
  estimatedBalance?: number | string | null;
  invoices?: Array<Pick<InvoiceRecord, 'status' | 'total_amount'>>;
  paymentLinks?: Array<Pick<PaymentLinkRecord, 'payment_mode'>>;
  confirmedPaidAmount?: number | string | null;
  hasConfirmedPaymentSignal?: boolean;
}

function toAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeResult(
  status: PaymentStatus,
  tone: PaymentStatusTone,
  label: string,
  reasons: string[],
  totalExpected: number | null,
  amountPaid: number | null,
): PaymentStatusResult {
  const safePaid = amountPaid === null ? null : Math.max(amountPaid, 0);
  const dueRaw = totalExpected === null || safePaid === null ? null : totalExpected - safePaid;

  return {
    status,
    tone,
    label,
    reasons,
    totalExpected,
    amountPaid: safePaid,
    amountDue: dueRaw === null ? null : Math.max(dueRaw, 0),
  };
}

export function getPaymentStatus(input: PaymentStatusInput): PaymentStatusResult {
  const reasons: string[] = [];

  if (input.eventStatus === 'cancelado') {
    reasons.push('event_status=cancelado');
    return makeResult('cancelled_or_inactive', 'danger', 'Cancelled / Inactive', reasons, null, null);
  }

  const invoices = input.invoices ?? [];
  const paymentLinks = input.paymentLinks ?? [];
  const paidAmount = toAmount(input.confirmedPaidAmount);
  const totalExpected = toAmount(input.quoteTotalAmount) ?? toAmount(invoices[0]?.total_amount);
  const expectedDeposit = toAmount(input.expectedDeposit);

  if (input.hasConfirmedPaymentSignal && paidAmount !== null && totalExpected !== null) {
    reasons.push('confirmed_payment_signal');
    if (paidAmount >= totalExpected) {
      return makeResult('paid_in_full', 'success', 'Paid in Full', reasons, totalExpected, paidAmount);
    }

    if (expectedDeposit !== null && paidAmount >= expectedDeposit) {
      reasons.push('paid_amount>=expected_deposit');
      return makeResult('deposit_paid_balance_pending', 'warning', 'Deposit Paid / Balance Pending', reasons, totalExpected, paidAmount);
    }

    return makeResult('reserved_not_paid_in_full', 'info', 'Reserved / Not Paid in Full', reasons, totalExpected, paidAmount);
  }

  const latestInvoice = invoices[0] ?? null;
  if (latestInvoice?.status === 'paid') {
    reasons.push('invoice_status=paid');
    return makeResult('paid_in_full', 'success', 'Paid in Full', reasons, totalExpected, totalExpected);
  }

  if (latestInvoice?.status === 'partially_paid') {
    reasons.push('invoice_status=partially_paid');
    if (expectedDeposit !== null && expectedDeposit > 0) {
      // Temporary fallback only:
      // - We use expectedDeposit as a proxy amountPaid when invoice is partially_paid
      //   and no canonical collected-payment signal is available in this flow.
      // - expectedDeposit is NOT confirmed money collected.
      // - Replace this with a canonical collected-payment signal (or ledger) once available.
      reasons.push('temporary_expected_deposit_fallback');
      return makeResult('deposit_paid_balance_pending', 'warning', 'Deposit Paid / Balance Pending', reasons, totalExpected, expectedDeposit);
    }

    return makeResult('reserved_not_paid_in_full', 'info', 'Reserved / Not Paid in Full', reasons, totalExpected, null);
  }

  if (input.preEventStatus === 'en_preparacion' || input.eventStatus === 'en_preparacion' || input.eventStatus === 'confirmado') {
    reasons.push('active_booking_status');

    if (latestInvoice?.status === 'issued' || paymentLinks.length > 0) {
      reasons.push(latestInvoice?.status === 'issued' ? 'invoice_status=issued' : 'payment_links=intent_only');
      return makeResult('reserved_not_paid_in_full', 'info', 'Reserved / Not Paid in Full', reasons, totalExpected, null);
    }

    return makeResult('payment_pending', 'neutral', 'Payment Pending', reasons, totalExpected, null);
  }

  if (latestInvoice?.status === 'issued') {
    reasons.push('invoice_status=issued');
    return makeResult('payment_pending', 'neutral', 'Payment Pending', reasons, totalExpected, null);
  }

  if (paymentLinks.length > 0) {
    reasons.push('payment_links_present_but_not_confirmed');
    return makeResult('payment_pending', 'neutral', 'Payment Pending', reasons, totalExpected, null);
  }

  if (totalExpected !== null || toAmount(input.estimatedBalance) !== null || expectedDeposit !== null) {
    reasons.push('expected_values_present_without_payment_confirmation');
    return makeResult('payment_pending', 'neutral', 'Payment Pending', reasons, totalExpected, null);
  }

  reasons.push('insufficient_data');
  return makeResult('unknown', 'neutral', 'Unknown', reasons, null, null);
}
