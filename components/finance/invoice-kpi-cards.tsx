import { Card, CardContent } from '@/components/ui/card';
import type { FinanceInvoiceAgingSummary } from '@/services/invoices/aging';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function InvoiceKpiCards({ summary }: { summary: FinanceInvoiceAgingSummary }) {
  const cards = [
    { label: 'Outstanding balance', value: formatMoney(summary.totalOutstandingBalance) },
    { label: 'Overdue balance', value: formatMoney(summary.totalOverdueBalance) },
    { label: 'Due soon (7 days)', value: formatMoney(summary.dueSoonBalance) },
    { label: 'Paid invoices', value: String(summary.paidCount) },
    { label: 'Partially paid', value: String(summary.partialCount) },
    { label: 'Pending (draft/issued)', value: String(summary.pendingCount) },
    { label: 'Overdue count', value: String(summary.overdueCount) },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{card.label}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
