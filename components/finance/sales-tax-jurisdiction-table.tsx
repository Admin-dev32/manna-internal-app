import type { SalesTaxBreakdownRow } from '@/lib/finance/sales-tax-report';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function SalesTaxJurisdictionTable({ rows, title }: { rows: SalesTaxBreakdownRow[]; title: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr><th className="px-3 py-2">Group</th><th className="px-3 py-2">Invoices</th><th className="px-3 py-2">Taxable</th><th className="px-3 py-2">Tax amount</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="border-t border-border">
                <td className="px-3 py-3 text-muted-foreground" colSpan={4}>No breakdown rows for the selected filters.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2">{row.key}</td>
                <td className="px-3 py-2">{row.invoiceCount}</td>
                <td className="px-3 py-2">{formatCurrency(row.taxableSales)}</td>
                <td className="px-3 py-2">{formatCurrency(row.taxAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
