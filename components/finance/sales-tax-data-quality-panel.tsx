import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesTaxKpis } from '@/lib/finance/sales-tax-report';

export function SalesTaxDataQualityPanel({ kpis }: { kpis: SalesTaxKpis }) {
  const hasAnyFlags = (
    kpis.invoicesMissingJurisdiction
    + kpis.invoicesWithZeroTaxButTaxableSales
    + kpis.invoicesWithTaxAmountButNoJurisdiction
    + kpis.historicalBackfillLikelyCount
  ) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales tax data quality signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">Use these checks to identify invoice tax-field gaps before preparing filings.</p>
        {!hasAnyFlags && (
          <p>No data quality flags in the selected range.</p>
        )}
        <p>Missing jurisdiction fields: <span className="font-medium">{kpis.invoicesMissingJurisdiction}</span></p>
        <p>Taxable sales with zero tax amount: <span className="font-medium">{kpis.invoicesWithZeroTaxButTaxableSales}</span></p>
        <p>Tax amount present but jurisdiction missing: <span className="font-medium">{kpis.invoicesWithTaxAmountButNoJurisdiction}</span></p>
        <p>Likely historical backfill invoices: <span className="font-medium">{kpis.historicalBackfillLikelyCount}</span></p>
      </CardContent>
    </Card>
  );
}
