import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceInvoiceAgingSummary, InvoiceAgingBucketKey } from '@/services/invoices/aging';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const LABELS: Record<InvoiceAgingBucketKey, string> = {
  current: 'Current',
  '1_30': '1-30 days overdue',
  '31_60': '31-60 days overdue',
  '61_90': '61-90 days overdue',
  '90_plus': '90+ days overdue',
  unknown: 'Unknown due date',
};

export function InvoiceAgingPanel({ summary }: { summary: FinanceInvoiceAgingSummary }) {
  const order: InvoiceAgingBucketKey[] = ['current', '1_30', '31_60', '61_90', '90_plus', 'unknown'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice aging</CardTitle>
        <CardDescription>Outstanding balances are bucketed by due date aging (read-only).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {order.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-foreground">{LABELS[key]}</p>
              <p className="text-xs text-muted-foreground">{summary.agingBuckets[key].count} invoices</p>
            </div>
            <p className="font-semibold text-foreground">{formatMoney(summary.agingBuckets[key].balance)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
