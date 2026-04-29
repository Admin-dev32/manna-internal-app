import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function RevenueByClientTable({ rows }: { rows: Array<{ clientName: string; total: number; balanceDue: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Client (signal)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No revenue rows by client for current filters.</p> : null}
        {rows.map((row) => (
          <div key={row.clientName} className="rounded-xl border border-border px-3 py-2">
            <p className="font-medium">{row.clientName}</p>
            <p className="text-xs text-muted-foreground">Revenue: {formatCurrency(row.total)} · Balance due: {formatCurrency(row.balanceDue)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
