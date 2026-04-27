import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';

export function BookingStatusLegend() {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Payment status legend</p>
      <div className="flex flex-wrap gap-2">
        <PaymentStatusBadge status="paid_in_full" />
        <PaymentStatusBadge status="deposit_paid_balance_pending" />
        <PaymentStatusBadge status="reserved_not_paid_in_full" />
        <PaymentStatusBadge status="payment_pending" />
        <PaymentStatusBadge status="cancelled_or_inactive" />
        <PaymentStatusBadge status="unknown" />
      </div>
    </div>
  );
}
