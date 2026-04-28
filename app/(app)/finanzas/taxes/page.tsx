import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { SalesTaxDataQualityPanel } from '@/components/finance/sales-tax-data-quality-panel';
import { SalesTaxInvoiceTable } from '@/components/finance/sales-tax-invoice-table';
import { SalesTaxJurisdictionTable } from '@/components/finance/sales-tax-jurisdiction-table';
import { SalesTaxSupportSummaryCards } from '@/components/finance/sales-tax-support-summary-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getSalesTaxSupportDataset } from '@/services/finance/sales-tax-report';

export default async function FinanzasTaxesPage({
  searchParams,
}: {
  searchParams: Promise<{
    taxDateFrom?: string;
    taxDateTo?: string;
    taxStatus?: string;
    taxJurisdiction?: string;
    taxRegion?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const taxDateFrom = String(resolvedSearchParams.taxDateFrom ?? '').trim() || null;
  const taxDateTo = String(resolvedSearchParams.taxDateTo ?? '').trim() || null;
  const taxStatusRaw = String(resolvedSearchParams.taxStatus ?? '').trim();
  const taxStatus = taxStatusRaw === 'draft' || taxStatusRaw === 'issued' || taxStatusRaw === 'partially_paid' || taxStatusRaw === 'paid' || taxStatusRaw === 'void'
    ? taxStatusRaw
    : 'all';
  const taxJurisdiction = String(resolvedSearchParams.taxJurisdiction ?? '').trim() || null;
  const taxRegion = String(resolvedSearchParams.taxRegion ?? '').trim() || null;

  const session = await requirePermission('finance.view');
  const canViewSalesTaxSupport = Boolean(
    session.user
    && (
      hasPermission(session.user, 'finance.view')
      || (session.user.permissions as string[]).includes('finance.tax.view')
      || (session.user.permissions as string[]).includes('finance.accounts.view')
    ),
  );

  const salesTaxSupport = canViewSalesTaxSupport
    ? await getSalesTaxSupportDataset({
        dateFrom: taxDateFrom,
        dateTo: taxDateTo,
        status: taxStatus,
        jurisdiction: taxJurisdiction,
        region: taxRegion,
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Taxes</h1>
        <p className="text-sm text-muted-foreground">Review sales-tax support data, invoice tax fields, and data quality before filing preparation.</p>
      </section>

      {!canViewSalesTaxSupport || !salesTaxSupport ? (
        <Card>
          <CardHeader>
            <CardTitle>No access</CardTitle>
            <CardDescription>Sales tax support requires finance/tax/accounting permissions.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You need <code>finance.tax.view</code>, <code>finance.view</code>, or <code>finance.accounts.view</code>.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Tax guardrails</h2>
            <p className="text-sm text-muted-foreground">Tax-prep support only. This page is not filing-ready.</p>
            <p className="text-sm text-muted-foreground">Support amounts are based on invoice header tax fields.</p>
            <p className="text-sm text-muted-foreground">This review does not confirm tax collected or remitted.</p>
            <p className="text-sm text-muted-foreground">Use these outputs to review records before preparing filings.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Sales tax summary</h2>
            <SalesTaxSupportSummaryCards kpis={salesTaxSupport.kpis} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Data quality</h2>
            <SalesTaxDataQualityPanel kpis={salesTaxSupport.kpis} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Breakdowns</h2>
            <div className="grid gap-6 xl:grid-cols-2">
              <SalesTaxJurisdictionTable rows={salesTaxSupport.byJurisdiction} title="By jurisdiction" />
              <SalesTaxJurisdictionTable rows={salesTaxSupport.byRegion} title="By region" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <SalesTaxJurisdictionTable rows={salesTaxSupport.byTaxRate} title="By tax rate" />
              <SalesTaxJurisdictionTable rows={salesTaxSupport.byStatus} title="By invoice status" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Invoice-level review</h2>
            <SalesTaxInvoiceTable rows={salesTaxSupport.rows} />
          </div>
        </section>
      )}
    </div>
  );
}
