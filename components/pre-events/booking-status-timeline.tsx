import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentStatusResult } from '@/lib/finance/payment-status';
import type { EventRecord } from '@/types/events';
import type { InvoiceRecord } from '@/types/invoices';
import type { PaymentLinkRecord } from '@/types/payments';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

function formatDateTime(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function BookingStatusTimeline({
  quote,
  preEvent,
  latestInvoice,
  paymentLinks,
  linkedEvent,
  paymentStatus,
}: {
  quote: QuoteRecord;
  preEvent: PreEventRecord;
  latestInvoice: InvoiceRecord | null;
  paymentLinks: PaymentLinkRecord[];
  linkedEvent: EventRecord | null;
  paymentStatus: PaymentStatusResult;
}) {
  const latestPaymentLink = paymentLinks[0] ?? null;

  const timeline = [
    { label: 'Quote source exists', value: `#${quote.id.slice(0, 8)} · ${quote.status}` },
    { label: 'Reservation created', value: formatDateTime(preEvent.created_at) },
    { label: 'Invoice created', value: latestInvoice ? `#${latestInvoice.invoice_number} · ${formatDateTime(latestInvoice.created_at)}` : 'N/D' },
    { label: 'Payment link created', value: latestPaymentLink ? `${latestPaymentLink.payment_mode} · ${formatDateTime(latestPaymentLink.created_at)}` : 'N/D' },
    { label: 'Event created', value: linkedEvent ? `#${linkedEvent.id.slice(0, 8)} · ${formatDateTime(linkedEvent.created_at)}` : 'N/D' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking / Payment Timeline</CardTitle>
        <CardDescription>Hitos clave del flujo Quote → Reserva → Evento con señal de cobro actual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {timeline.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-muted/20 px-3 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Current payment status</p>
          <PaymentStatusBadge result={paymentStatus} />
        </div>
      </CardContent>
    </Card>
  );
}
