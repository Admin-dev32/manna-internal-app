import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function ContractorPayoutSummaryTable({ rows }: { rows: Array<{ status: string; total: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contractor Payout Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No data for current filters.</p> : null}
        {rows.map((row) => (
          <div key={row.status} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <span className="capitalize">{row.status.replace('_', ' ')}</span>
            <strong>{formatCurrency(row.total)}</strong>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
