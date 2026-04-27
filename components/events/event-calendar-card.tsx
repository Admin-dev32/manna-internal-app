import type { Route } from 'next';
import Link from 'next/link';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import type { PaymentStatusResult } from '@/lib/finance/payment-status';
import type { EventRecord } from '@/types/events';

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return 'N/D';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function EventCalendarCard({
  event,
  clientName,
  paymentStatus,
}: {
  event: EventRecord;
  clientName: string;
  paymentStatus: PaymentStatusResult;
}) {
  return (
    <Link
      href={`/eventos/${event.id}` as Route}
      className="block rounded-xl border border-border/70 bg-muted/20 p-2 transition hover:border-primary hover:bg-primary/5"
    >
      <p className="text-xs font-semibold text-foreground">{event.event_type ?? `Evento #${event.id.slice(0, 6)}`}</p>
      <p className="text-[11px] text-muted-foreground">{event.event_time} · {clientName}</p>
      <p className="text-[11px] text-muted-foreground">{event.location ?? 'Ubicación pendiente'}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        <EventStatusBadge status={event.status} />
        <PaymentStatusBadge result={paymentStatus} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Balance: {formatMoney(paymentStatus.amountDue)}</p>
    </Link>
  );
}
