import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentStatusResult } from '@/lib/finance/payment-status';

function formatMoney(value: number | string | null) {
  if (value === null || value === undefined || value === '') return 'N/D';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parsed);
}

export function PaymentSummaryCard({
  totalExpected,
  expectedDeposit,
  paymentStatus,
}: {
  totalExpected: number | string | null;
  expectedDeposit: number | string | null;
  paymentStatus: PaymentStatusResult;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Summary</CardTitle>
        <CardDescription>Vista invoice-like de referencia para la reserva. Read-only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusBadge result={paymentStatus} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Total expected" value={formatMoney(totalExpected)} />
          <Metric label="Expected deposit" value={formatMoney(expectedDeposit)} />
          <Metric label="Amount paid / known" value={formatMoney(paymentStatus.amountPaid)} />
          <Metric label="Balance due" value={formatMoney(paymentStatus.amountDue)} />
        </div>

        <p className="text-xs text-muted-foreground">
          Amount paid usa únicamente señal conocida/canónica disponible en el sistema actual.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
