import type { CreateManualInvoiceInput } from '@/types/invoices';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function toMoney(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100) / 100;
}

function parseOptionalIsoDate(dateValue: string | null) {
  if (!dateValue) return { ok: true as const, value: null };

  if (!ISO_DATE_PATTERN.test(dateValue)) {
    return { ok: false as const, message: 'La fecha de vencimiento debe tener formato YYYY-MM-DD.' };
  }

  const parsed = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateValue) {
    return { ok: false as const, message: 'La fecha de vencimiento debe ser válida en formato YYYY-MM-DD.' };
  }

  return { ok: true as const, value: parsed.toISOString() };
}

export interface PreparedManualInvoiceInput {
  clientId: string | null;
  manualCustomerName: string | null;
  manualCustomerEmail: string | null;
  manualTitle: string;
  manualDescription: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  depositAmount: number;
  balanceDue: number;
  dueAtIso: string | null;
  notes: string | null;
}

export function validateCreateManualInvoiceInput(input: CreateManualInvoiceInput) {
  const clientId = normalizeOptionalString(input.clientId);
  const manualCustomerName = normalizeOptionalString(input.manualCustomerName);
  const manualCustomerEmail = normalizeOptionalString(input.manualCustomerEmail);
  const manualTitle = normalizeOptionalString(input.manualTitle);
  const manualDescription = normalizeOptionalString(input.manualDescription);
  const notes = normalizeOptionalString(input.notes);
  const dueAt = normalizeOptionalString(input.dueAt);

  if (!clientId && !manualCustomerName) {
    return { ok: false as const, message: 'Debes enviar clientId o manualCustomerName.' };
  }

  if (!manualTitle) {
    return { ok: false as const, message: 'manualTitle es obligatorio.' };
  }

  if (manualCustomerEmail && !EMAIL_PATTERN.test(manualCustomerEmail)) {
    return { ok: false as const, message: 'manualCustomerEmail tiene formato inválido.' };
  }

  const subtotal = toMoney(input.subtotal);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false as const, message: 'subtotal debe ser mayor a 0.' };
  }

  const discountAmount = toMoney(input.discountAmount);
  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { ok: false as const, message: 'discountAmount debe ser mayor o igual a 0.' };
  }

  if (discountAmount > subtotal) {
    return { ok: false as const, message: 'discountAmount no puede ser mayor que subtotal.' };
  }

  const totalAmount = toMoney(subtotal - discountAmount);
  const depositAmount = toMoney(input.depositAmount);
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return { ok: false as const, message: 'depositAmount debe ser mayor o igual a 0.' };
  }

  if (depositAmount > totalAmount) {
    return { ok: false as const, message: 'depositAmount no puede ser mayor que el total.' };
  }

  const balanceDue = toMoney(totalAmount - depositAmount);
  const dueAtResult = parseOptionalIsoDate(dueAt);
  if (!dueAtResult.ok) return dueAtResult;

  return {
    ok: true as const,
    value: {
      clientId,
      manualCustomerName,
      manualCustomerEmail,
      manualTitle,
      manualDescription,
      subtotal,
      discountAmount,
      totalAmount,
      depositAmount,
      balanceDue,
      dueAtIso: dueAtResult.value,
      notes,
    } satisfies PreparedManualInvoiceInput,
  };
}
