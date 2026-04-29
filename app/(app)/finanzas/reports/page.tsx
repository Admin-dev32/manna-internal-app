import { ContractorPayoutSummaryTable } from '@/components/finance/contractor-payout-summary-table';
import { FinanceReportsSummaryCards } from '@/components/finance/finance-reports-summary-cards';
import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { OperatingPLPanel } from '@/components/finance/operating-pl-panel';
import { RevenueByClientTable } from '@/components/finance/revenue-by-client-table';
import { RevenueByEventTable } from '@/components/finance/revenue-by-event-table';
import { SpendingByCategoryTable } from '@/components/finance/spending-by-category-table';
import { SpendingByEventTable } from '@/components/finance/spending-by-event-table';
import { SpendingByVendorTable } from '@/components/finance/spending-by-vendor-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { computeFinanceReports, getFinanceReportsData } from '@/services/finance/reports';

export default async function FinanzasReportsPage() {
  await requirePermission('finance.view');
  const reportsRows = await getFinanceReportsData();
  const reports = computeFinanceReports(reportsRows, {});

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Operational Reports</h1>
        <p className="text-sm text-muted-foreground">
          Review revenue signals, spending, vendor costs, and event profitability without replacing GL reports.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signal-based reports</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            These reports are operational signals and may differ from final posted accounting outcomes.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounting boundary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            GL-posted accounting reports live under <strong>Accounting</strong>.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax boundary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tax-prep reports and tax-quality analysis live under <strong>Taxes</strong>.
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Report summary</h2>
          <p className="text-sm text-muted-foreground">High-level operational signal view. Differences vs posted ledger can exist until workflows are fully posted.</p>
        </div>
        <FinanceReportsSummaryCards
          revenueSignal={reports.revenueSignal}
          outstandingBalance={reports.outstandingBalance}
          approvedExpenses={reports.approvedExpenses}
          contractorPaid={reports.contractorPaid}
          estimatedNet={reports.estimatedNet}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <OperatingPLPanel
            revenueSignal={reports.revenueSignal}
            approvedExpenses={reports.approvedExpenses}
            contractorPaid={reports.contractorPaid}
            estimatedNet={reports.estimatedNet}
          />
          <ContractorPayoutSummaryTable rows={reports.contractorPayoutSummary} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Revenue reports</h2>
          <p className="text-sm text-muted-foreground">Revenue signal and outstanding balance views by client and event.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <RevenueByClientTable rows={reports.revenueByClient} />
          <RevenueByEventTable rows={reports.revenueByEvent} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Spending reports</h2>
          <p className="text-sm text-muted-foreground">Approved spending views by category, event, and vendor for operational cost control.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <SpendingByCategoryTable rows={reports.spendingByCategory} />
          <SpendingByEventTable rows={reports.spendingByEvent} />
          <SpendingByVendorTable rows={reports.spendingByVendor} />
        </div>
      </section>
    </div>
  );
}
