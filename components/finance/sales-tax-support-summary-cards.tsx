import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesTaxKpis } from '@/lib/finance/sales-tax-report';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function SalesTaxSupportSummaryCards({ kpis }: { kpis: SalesTaxKpis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader><CardTitle className="text-sm">Invoice count</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{kpis.invoiceCount}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Taxable sales</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatCurrency(kpis.taxableSales)}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Non-taxable sales</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatCurrency(kpis.nonTaxableSales)}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Tax amount on invoices</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatCurrency(kpis.taxAmount)}</p></CardContent></Card>
    </div>
  );
}
