import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function SpendingByEventTable({ rows }: { rows: Array<{ eventLabel: string; total: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Event (approved)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No spending rows by event for current filters.</p> : null}
        {rows.map((row) => (
          <div key={row.eventLabel} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <span className="line-clamp-1">{row.eventLabel}</span>
            <strong>{formatCurrency(row.total)}</strong>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
