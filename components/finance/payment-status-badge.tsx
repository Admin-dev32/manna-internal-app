import { Badge } from '@/components/ui/badge';
import type { PaymentStatus, PaymentStatusResult } from '@/lib/finance/payment-status';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid_in_full: 'Paid in Full',
  deposit_paid_balance_pending: 'Deposit Paid / Balance Pending',
  reserved_not_paid_in_full: 'Reserved / Not Paid in Full',
  payment_pending: 'Payment Pending',
  cancelled_or_inactive: 'Cancelled / Inactive',
  unknown: 'Unknown',
};

function getBadgeStyle(status: PaymentStatus) {
  switch (status) {
    case 'paid_in_full':
      return { variant: 'success' as const, className: '' };
    case 'deposit_paid_balance_pending':
      return { variant: 'warning' as const, className: '' };
    case 'reserved_not_paid_in_full':
      return { variant: 'default' as const, className: 'bg-sky-100 text-sky-700' };
    case 'cancelled_or_inactive':
      return { variant: 'outline' as const, className: 'border-rose-200 bg-rose-50 text-rose-700' };
    case 'payment_pending':
    case 'unknown':
    default:
      return { variant: 'outline' as const, className: '' };
  }
}

export function PaymentStatusBadge({
  result,
  status,
}: {
  result?: PaymentStatusResult;
  status?: PaymentStatus;
}) {
  const resolvedStatus = result?.status ?? status ?? 'unknown';
  const label = result?.label ?? STATUS_LABELS[resolvedStatus];
  const style = getBadgeStyle(resolvedStatus);

  return (
    <Badge variant={style.variant} className={style.className} title={result?.reasons.join(' · ')}>
      {label}
    </Badge>
  );
}
