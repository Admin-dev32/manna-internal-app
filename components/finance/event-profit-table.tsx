import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceOverviewEventProfitRow } from '@/services/finance/queries';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function EventProfitTable({ rows }: { rows: FinanceOverviewEventProfitRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Profit Table</CardTitle>
        <CardDescription>Vista por evento de ingresos/gastos conocidos y señal de pago.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.slice(0, 12).map((row) => (
          <div key={row.eventId} className="rounded-xl border border-border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{row.clientName} · {row.eventDate}</p>
              <PaymentStatusBadge result={row.paymentStatus} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Expected: {formatMoney(row.expectedIncome)} · Paid: {formatMoney(row.knownPaid)} · Projected exp: {formatMoney(row.projectedExpenses)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Actual exp: {formatMoney(row.actualExpenses)} · Estimated profit: {formatMoney(row.estimatedProfit)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
