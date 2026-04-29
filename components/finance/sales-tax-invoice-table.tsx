import type { SalesTaxInvoiceRow } from '@/lib/finance/sales-tax-report';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function SalesTaxInvoiceTable({ rows }: { rows: SalesTaxInvoiceRow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Invoice-level tax-field detail for pre-filing review.</p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Taxable</th><th className="px-3 py-2">Non-taxable</th><th className="px-3 py-2">Tax amount</th><th className="px-3 py-2">Jurisdiction/Region</th><th className="px-3 py-2">Exemption</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-border">
              <td className="px-3 py-3 text-muted-foreground" colSpan={8}>No tax-support invoices found for the selected filters.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2">{row.invoiceNumber}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.reportDate}</td>
              <td className="px-3 py-2">{formatCurrency(row.taxableSales)}</td>
              <td className="px-3 py-2">{formatCurrency(row.nonTaxableSales)}</td>
              <td className="px-3 py-2">{formatCurrency(row.taxAmount)}</td>
              <td className="px-3 py-2">{row.jurisdiction ?? 'Unknown'} / {row.region ?? 'Unknown'}</td>
              <td className="px-3 py-2">{row.exemptionReason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
