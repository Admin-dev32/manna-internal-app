import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentLinkRecord } from '@/types/payments';

function formatMoney(value: number | string | null) {
  if (value === null || value === undefined || value === '') return 'N/D';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parsed);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function PaymentLinksPanel({ paymentLinks }: { paymentLinks: PaymentLinkRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Links Panel</CardTitle>
        <CardDescription>Canales de cobro generados para la reserva (intención de cobro, no confirmación de pago).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {paymentLinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Sin payment links registrados todavía.
          </div>
        ) : (
          paymentLinks.map((link) => (
            <div key={link.id} className="rounded-2xl border border-border bg-background p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{link.payment_mode === 'deposit' ? 'Deposit' : 'Full'}</Badge>
                <Badge variant="outline">Source: {link.source_record_type}</Badge>
                <Badge variant="outline">{formatDateTime(link.created_at)}</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Row label="Amount to charge" value={formatMoney(link.amount_to_charge)} />
                <Row label="Balance due" value={formatMoney(link.balance_due)} />
              </div>
              <p className="mt-3 break-all text-xs text-muted-foreground">{link.external_url}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
