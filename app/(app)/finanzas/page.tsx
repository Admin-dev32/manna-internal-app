import { EventProfitTable } from '@/components/finance/event-profit-table';
import { ExpensesModule } from '@/components/finance/expenses-module';
import { FinanceInvoiceDetailPanel } from '@/components/finance/finance-invoice-detail';
import { InvoiceAgingPanel } from '@/components/finance/invoice-aging-panel';
import { InvoiceFollowUpList } from '@/components/finance/invoice-follow-up-list';
import { InvoiceKpiCards } from '@/components/finance/invoice-kpi-cards';
import { FinanceOverviewCards } from '@/components/finance/finance-overview-cards';
import { FinanceReportsSummaryCards } from '@/components/finance/finance-reports-summary-cards';
import { InvoiceTemplatesEntrypoint } from '@/components/finance/invoice-templates-entrypoint';
import { FinanceInvoicesList } from '@/components/finance/finance-invoices-list';
import { FinancialSettingsForm } from '@/components/finance/financial-settings-form';
import { OperatingPLPanel } from '@/components/finance/operating-pl-panel';
import { ProjectedVsActualPanel } from '@/components/finance/projected-vs-actual-panel';
import { RevenuePipeline } from '@/components/finance/revenue-pipeline';
import { ContractorPayoutSummaryTable } from '@/components/finance/contractor-payout-summary-table';
import { RevenueByClientTable } from '@/components/finance/revenue-by-client-table';
import { RevenueByEventTable } from '@/components/finance/revenue-by-event-table';
import { SpendingByCategoryTable } from '@/components/finance/spending-by-category-table';
import { SpendingByEventTable } from '@/components/finance/spending-by-event-table';
import { SpendingByVendorTable } from '@/components/finance/spending-by-vendor-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { searchManualInvoiceClients } from '@/services/clients/queries';
import { getFinancialExpenses, getFinanceOverviewData, getFinancialSettings } from '@/services/finance/queries';
import { computeFinanceReports, getFinanceReportsData } from '@/services/finance/reports';
import { getFinanceInvoiceAgingSummary, getFinanceInvoiceById, getFinanceInvoices, getInvoiceEmailDeliveriesByInvoiceId } from '@/services/invoices/queries';

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedInvoiceId = String(resolvedSearchParams.invoice ?? '').trim() || null;

  const [session, { settings, expenses }, expensesModuleData, overview, financeInvoices, invoiceAgingSummary, manualInvoiceClients, reportsRows] = await Promise.all([
    requirePermission('finance.view'),
    getFinancialSettings(),
    getFinancialExpenses(),
    getFinanceOverviewData(),
    getFinanceInvoices({ limit: 120 }),
    getFinanceInvoiceAgingSummary(),
    searchManualInvoiceClients('', 80),
    getFinanceReportsData(),
  ]);
  const reports = computeFinanceReports(reportsRows, {});

  const canEditDefaults = Boolean(session.user && hasPermission(session.user, 'finance.manage_defaults'));
  const canViewExpenses = Boolean(
    session.user &&
      (hasPermission(session.user, 'finance.expenses.view') || hasPermission(session.user, 'finance.expenses.manage') || hasPermission(session.user, 'finance.expenses.approve')),
  );
  const canManageExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.manage'));
  const canApproveExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.approve'));
  const canViewInvoices = Boolean(session.user && (hasPermission(session.user, 'finance.invoices.view') || hasPermission(session.user, 'finance.invoices.manage')));
  const canManageInvoices = Boolean(session.user && hasPermission(session.user, 'finance.invoices.manage'));
  const canManageEmailTemplates = Boolean(session.user && hasPermission(session.user, 'settings.view'));
  const selectedInvoiceDetail = canViewInvoices && selectedInvoiceId ? await getFinanceInvoiceById(selectedInvoiceId) : null;
  const selectedInvoiceDeliveries = selectedInvoiceDetail
    ? await getInvoiceEmailDeliveriesByInvoiceId(selectedInvoiceDetail.invoice.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Finanzas internas</Badge>
          <Badge className="bg-white/10 text-white">{canEditDefaults ? 'Owner editable' : 'Acceso restringido'}</Badge>
          <Badge className="bg-white/10 text-white">{canViewExpenses ? 'Spending activo' : 'Spending oculto por permisos'}</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Defaults globales + spending transaccional</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            La hoja de quote sigue siendo planeación financiera. El submódulo de spending captura gastos reales operativos para trazabilidad y aprobación.
          </p>
        </div>
      </section>


      <FinanceOverviewCards
        expectedIncome={overview.expectedIncome}
        knownPaidIncome={overview.knownPaidIncome}
        pendingBalance={overview.pendingBalance}
        projectedExpenses={overview.projectedExpenses}
        actualApprovedExpenses={overview.actualApprovedExpenses}
        projectedProfit={overview.projectedProfit}
        knownProfit={overview.knownProfit}
      />
      <p className="text-sm text-muted-foreground">
        These totals are based on currently available payment signals and are not a ledger-confirmed cash report yet. Overview is based on recent
        reservations/events for now.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <RevenuePipeline rows={overview.reservationsPipeline} />
        <ProjectedVsActualPanel
          projectedExpenses={overview.projectedExpenses}
          actualApprovedExpenses={overview.actualApprovedExpenses}
          projectedProfit={overview.projectedProfit}
          knownProfit={overview.knownProfit}
        />
      </div>

      <EventProfitTable rows={overview.eventsProfitability} />

      <InvoiceKpiCards summary={invoiceAgingSummary} />
      <div className="grid gap-6 xl:grid-cols-2">
        <InvoiceAgingPanel summary={invoiceAgingSummary} />
        <InvoiceFollowUpList summary={invoiceAgingSummary} />
      </div>

      <FinanceInvoicesList invoices={financeInvoices} canView={canViewInvoices} canManage={canManageInvoices} manualInvoiceClients={manualInvoiceClients} />
      {canViewInvoices && selectedInvoiceDetail ? (
        <FinanceInvoiceDetailPanel
          detail={selectedInvoiceDetail}
          deliveries={selectedInvoiceDeliveries}
          canManageInvoices={canManageInvoices}
        />
      ) : null}

      <InvoiceTemplatesEntrypoint canManageTemplates={canManageEmailTemplates} />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Finance Reports</h2>
          <p className="text-sm text-muted-foreground">
            Operational reporting view for tax-prep support. Not final filing and not ledger-confirmed cash accounting.
          </p>
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

        <div className="grid gap-6 xl:grid-cols-3">
          <SpendingByCategoryTable rows={reports.spendingByCategory} />
          <SpendingByEventTable rows={reports.spendingByEvent} />
          <SpendingByVendorTable rows={reports.spendingByVendor} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <RevenueByClientTable rows={reports.revenueByClient} />
          <RevenueByEventTable rows={reports.revenueByEvent} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <FinancialSettingsForm settings={settings} expenses={expenses} canEdit={canEditDefaults} />
          <ExpensesModule
            expenses={expensesModuleData.expenses}
            eventOptions={expensesModuleData.eventOptions}
            eventSearchOptions={expensesModuleData.eventSearchOptions}
            categories={expensesModuleData.categories}
            canView={canViewExpenses}
            canManage={canManageExpenses}
            canApprove={canApproveExpenses}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cómo vive en el flujo</CardTitle>
              <CardDescription>La capa financiera es interna y separada de la vista comercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-background p-4">
                <p className="font-medium text-foreground">Base actual</p>
                <p className="mt-2">Cada hoja financiera se liga primero a una cotización, que ya es la base económica del flujo comercial.</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <p className="font-medium text-foreground">Spending transaccional nuevo</p>
                <p className="mt-2">Los gastos reales no reemplazan la proyección de la quote; se registran como transacciones con scope general o por evento.</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <p className="font-medium text-foreground">Protección</p>
                <p className="mt-2">Esta pantalla exige `finance.view`; el bloque de spending aplica permisos finos de view/manage/approve.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
