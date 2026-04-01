import type { PaymentMode } from '@/types/payments';
import type { QuoteRecord } from '@/types/quotes';

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface QuoteCommercialPaymentMode {
  mode: PaymentMode;
  modeLabel: string;
  amountToCharge: number;
  amountToChargeLabel: string;
  estimatedBalance: number;
  rationale: string;
}

export function getQuoteCommercialPaymentMode(quote: QuoteRecord): QuoteCommercialPaymentMode {
  const total = toNumber(quote.total_amount);
  const expectedDeposit = toNumber(quote.expected_deposit);
  const estimatedBalance = toNumber(quote.estimated_balance);

  const shouldUseFull = expectedDeposit >= total || estimatedBalance <= 0;
  const mode: PaymentMode = shouldUseFull ? 'full' : 'deposit';
  const amountToCharge = shouldUseFull ? total : expectedDeposit;

  return {
    mode,
    modeLabel: shouldUseFull ? 'Pago completo' : 'Depósito',
    amountToCharge,
    amountToChargeLabel: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amountToCharge),
    estimatedBalance,
    rationale: shouldUseFull
      ? 'La cotización no deja saldo pendiente, por eso el cobro comercial activo es pago completo.'
      : 'La cotización define un depósito inicial y saldo restante, por eso el cobro comercial activo es depósito.',
  };
}
