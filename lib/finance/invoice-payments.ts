import type { InvoicePaymentMethod, InvoicePaymentRecord, InvoicePaymentStatus } from '@/types/invoices';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function toMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100) / 100;
}

export interface RecordManualInvoicePaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  reference?: string | null;
  feeAmount?: number | null;
  depositedToAccountId?: string | null;
  notes?: string | null;
}

export interface PreparedManualInvoicePaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  reference: string | null;
  feeAmount: number;
  netAmount: number;
  depositedToAccountId: string | null;
  notes: string | null;
}

export interface InvoicePaymentSummary {
  totalPaidSucceeded: number;
  totalFees: number;
  totalNet: number;
  paymentCount: number;
  latestPaymentDate: string | null;
}

export function isValidInvoicePaymentMethod(value: string): value is InvoicePaymentMethod {
  return value === 'stripe' || value === 'zelle' || value === 'cash' || value === 'card' || value === 'bank_transfer' || value === 'manual_adjustment' || value === 'other';
}

export function normalizeInvoicePaymentMethod(value: string | null | undefined): InvoicePaymentMethod {
  if (!value) return 'other';
  return isValidInvoicePaymentMethod(value) ? value : 'other';
}

export function validateRecordManualInvoicePaymentInput(input: RecordManualInvoicePaymentInput) {
  const amount = toMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, message: 'amount debe ser mayor a 0.' };
  }

  const feeAmount = toMoney(input.feeAmount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount < 0) {
    return { ok: false as const, message: 'feeAmount debe ser mayor o igual a 0.' };
  }

  if (feeAmount > amount) {
    return { ok: false as const, message: 'feeAmount no puede ser mayor que amount.' };
  }

  if (!isValidInvoicePaymentMethod(input.paymentMethod)) {
    return { ok: false as const, message: 'paymentMethod inválido.' };
  }

  const paymentDate = normalizeOptionalString(input.paymentDate);
  if (!paymentDate || !ISO_DATE_PATTERN.test(paymentDate)) {
    return { ok: false as const, message: 'paymentDate debe tener formato YYYY-MM-DD.' };
  }

  const parsedDate = new Date(`${paymentDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== paymentDate) {
    return { ok: false as const, message: 'paymentDate debe ser una fecha válida en formato YYYY-MM-DD.' };
  }

  const depositedToAccountId = normalizeOptionalString(input.depositedToAccountId);

  return {
    ok: true as const,
    value: {
      amount,
      paymentDate,
      paymentMethod: input.paymentMethod,
      reference: normalizeOptionalString(input.reference),
      feeAmount,
      netAmount: toMoney(amount - feeAmount),
      depositedToAccountId,
      notes: normalizeOptionalString(input.notes),
    } satisfies PreparedManualInvoicePaymentInput,
  };
}

function toSummaryRow(values: Pick<InvoicePaymentRecord, 'status' | 'amount' | 'fee_amount' | 'net_amount' | 'payment_date'>) {
  return {
    status: values.status,
    amount: toMoney(values.amount),
    feeAmount: toMoney(values.fee_amount),
    netAmount: toMoney(values.net_amount),
    paymentDate: normalizeOptionalString(values.payment_date),
  };
}

export function computeInvoicePaymentSummary(
  payments: Array<Pick<InvoicePaymentRecord, 'status' | 'amount' | 'fee_amount' | 'net_amount' | 'payment_date'>>,
): InvoicePaymentSummary {
  const succeeded = payments.map(toSummaryRow).filter((payment) => payment.status === ('succeeded' satisfies InvoicePaymentStatus));

  const totalPaidSucceeded = succeeded.reduce((sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0), 0);
  const totalFees = succeeded.reduce((sum, payment) => sum + (Number.isFinite(payment.feeAmount) ? payment.feeAmount : 0), 0);
  const totalNet = succeeded.reduce((sum, payment) => sum + (Number.isFinite(payment.netAmount) ? payment.netAmount : 0), 0);
  const latestPaymentDate = succeeded
    .map((payment) => payment.paymentDate)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;

  return {
    totalPaidSucceeded: toMoney(totalPaidSucceeded),
    totalFees: toMoney(totalFees),
    totalNet: toMoney(totalNet),
    paymentCount: succeeded.length,
    latestPaymentDate,
  };
}
