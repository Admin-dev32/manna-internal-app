import type { ContractorPayoutPaymentMethod, ContractorPayoutStatus } from '@/types/finance';

export interface ContractorPayoutAssignmentRef {
  id: string;
  event_id: string;
  profile_id: string;
}

export interface ContractorPayoutDraftInput {
  profile_id: string;
  event_id: string | null;
  assignment_id: string | null;
  amount: number;
  currency?: 'usd';
  payout_date?: string | null;
  payment_method?: ContractorPayoutPaymentMethod;
  notes?: string | null;
  external_reference?: string | null;
  idempotency_key?: string | null;
  source_expense_id?: string | null;
}

const DRAFT_EDITABLE_STATUSES: ContractorPayoutStatus[] = ['draft'];
const CANCELLABLE_STATUSES: ContractorPayoutStatus[] = ['draft', 'approved'];

export function isValidContractorPayoutStatus(value: string): value is ContractorPayoutStatus {
  return value === 'draft' || value === 'approved' || value === 'paid' || value === 'cancelled' || value === 'reversed';
}

export function isValidContractorPayoutPaymentMethod(value: string): value is ContractorPayoutPaymentMethod {
  return value === 'cash' || value === 'zelle' || value === 'bank_transfer' || value === 'card' || value === 'other';
}

export function normalizeContractorPayoutPaymentMethod(value: string | null | undefined): ContractorPayoutPaymentMethod {
  if (!value) return 'other';
  return isValidContractorPayoutPaymentMethod(value) ? value : 'other';
}

export function canEditContractorPayoutDraft(status: ContractorPayoutStatus) {
  return DRAFT_EDITABLE_STATUSES.includes(status);
}

export function canCancelContractorPayout(status: ContractorPayoutStatus) {
  return CANCELLABLE_STATUSES.includes(status);
}

export function canTransitionContractorPayoutStatus(from: ContractorPayoutStatus, to: ContractorPayoutStatus) {
  if (from === 'draft' && (to === 'approved' || to === 'cancelled')) return true;
  if (from === 'approved' && (to === 'paid' || to === 'cancelled')) return true;
  return false;
}

export function validateContractorPayoutDraftInput(input: ContractorPayoutDraftInput) {
  if (!input.profile_id) {
    return { ok: false as const, message: 'El profile_id es obligatorio.' };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false as const, message: 'El monto debe ser mayor a 0.' };
  }

  if (input.currency && input.currency !== 'usd') {
    return { ok: false as const, message: 'La moneda soportada en esta fase es USD.' };
  }

  if (input.assignment_id && !input.event_id) {
    return { ok: false as const, message: 'assignment_id requiere event_id.' };
  }

  if (input.source_expense_id) {
    return { ok: false as const, message: 'source_expense_id no está habilitado en esta fase.' };
  }

  if (input.payment_method && !isValidContractorPayoutPaymentMethod(input.payment_method)) {
    return { ok: false as const, message: 'Método de pago inválido.' };
  }

  return { ok: true as const };
}

export function validateContractorPayoutAssignmentConsistency({
  eventId,
  profileId,
  assignment,
}: {
  eventId: string | null;
  profileId: string;
  assignment: ContractorPayoutAssignmentRef | null;
}) {
  if (!assignment) return { ok: true as const };

  if (!eventId) {
    return { ok: false as const, message: 'assignment_id requiere event_id.' };
  }

  if (assignment.event_id !== eventId) {
    return { ok: false as const, message: 'assignment_id no corresponde al event_id enviado.' };
  }

  if (assignment.profile_id !== profileId) {
    return { ok: false as const, message: 'assignment_id no corresponde al profile_id enviado.' };
  }

  return { ok: true as const };
}
