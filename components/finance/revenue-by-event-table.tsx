import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function RevenueByEventTable({ rows }: { rows: Array<{ eventLabel: string; total: number; balanceDue: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Event (signal)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No data for current filters.</p> : null}
        {rows.map((row) => (
          <div key={row.eventLabel} className="rounded-xl border border-border px-3 py-2">
            <p className="line-clamp-1 font-medium">{row.eventLabel}</p>
            <p className="text-xs text-muted-foreground">Revenue: {formatCurrency(row.total)} · Balance due: {formatCurrency(row.balanceDue)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
