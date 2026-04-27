import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceOverviewReservationPipelineRow } from '@/services/finance/queries';

function formatMoney(value: number | null) {
  if (value === null) return 'N/D';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function RevenuePipeline({ rows }: { rows: FinanceOverviewReservationPipelineRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Pipeline</CardTitle>
        <CardDescription>Reservas/eventos con señal de pago y balance pendiente (read-only).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.slice(0, 12).map((row) => (
          <div key={row.preEventId} className="rounded-xl border border-border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{row.clientName}</p>
              <PaymentStatusBadge result={row.paymentStatus} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reserva: {row.reservationDate ?? 'N/D'} · Evento: {row.eventDate ?? 'N/D'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total expected: {formatMoney(row.totalExpected)} · Amount due: {formatMoney(row.amountDue)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
