import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventFinanceSnapshot } from '@/types/events';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function FinancialSummaryCard({ summary, title, description }: { summary: EventFinanceSnapshot; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryItem label="Gross revenue" value={formatCurrency(summary.grossRevenue)} />
        <SummaryItem label="Tax reserve" value={formatCurrency(summary.taxReserve)} />
        <SummaryItem label="Sales commission" value={formatCurrency(summary.salesCommission)} />
        <SummaryItem label="Extra expenses" value={formatCurrency(summary.totalExtraExpenses)} />
        <SummaryItem label="Net profit" value={formatCurrency(summary.netProfit)} emphasis />
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-background'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${emphasis ? 'text-emerald-700' : 'text-primary'}`}>{label}</p>
      <p className={`mt-2 text-sm font-medium ${emphasis ? 'text-emerald-900' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
