import type { Route } from 'next';
import Link from 'next/link';

import { ContractorPayoutSummaryTable } from '@/components/finance/contractor-payout-summary-table';
import { EventProfitTable } from '@/components/finance/event-profit-table';
import { FinanceOverviewCards } from '@/components/finance/finance-overview-cards';
import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { InvoiceFollowUpList } from '@/components/finance/invoice-follow-up-list';
import { InvoiceKpiCards } from '@/components/finance/invoice-kpi-cards';
import { ProjectedVsActualPanel } from '@/components/finance/projected-vs-actual-panel';
import { RevenuePipeline } from '@/components/finance/revenue-pipeline';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getFinanceOverviewData } from '@/services/finance/queries';
import { computeFinanceReports, getFinanceReportsData } from '@/services/finance/reports';
import { getFinanceInvoiceAgingSummary } from '@/services/invoices/queries';

export default async function FinanzasPage() {
  const [session, overview, invoiceAgingSummary, reportsRows] = await Promise.all([
    requirePermission('finance.view'),
    getFinanceOverviewData(),
    getFinanceInvoiceAgingSummary(),
    getFinanceReportsData(),
  ]);

  const reports = computeFinanceReports(reportsRows, {});
  const canEditDefaults = Boolean(session.user && hasPermission(session.user, 'finance.manage_defaults'));
  const canViewExpenses = Boolean(
    session.user
    && (
      hasPermission(session.user, 'finance.expenses.view')
      || hasPermission(session.user, 'finance.expenses.manage')
      || hasPermission(session.user, 'finance.expenses.approve')
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Finanzas internas</Badge>
          <Badge className="bg-white/10 text-white">{canEditDefaults ? 'Owner editable' : 'Acceso restringido'}</Badge>
          <Badge className="bg-white/10 text-white">{canViewExpenses ? 'Spending activo' : 'Spending oculto por permisos'}</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Finance Overview</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Dashboard financiero resumido. Usa las secciones para entrar a invoices, expenses, reports, accounting, taxes y settings.
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Finance boundaries</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Operational vs GL reports</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Operational reports are signal-based and can differ from posted General Ledger reports.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Tax support boundary</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Sales tax support is for preparation review and is not filing-ready output.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Journal status boundary</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Draft journal entries are review records and do not affect posted GL balances.</CardContent>
          </Card>
        </div>
      </section>

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
      <InvoiceFollowUpList summary={invoiceAgingSummary} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <QuickLinkCard
          title="Invoices"
          description="Aging, follow-up, invoice detail, email delivery, and payment records."
          href="/finanzas/invoices"
          cta="Open invoices"
        />
        <QuickLinkCard
          title="Expenses"
          description="Expense operations, receipts, categorization, and approval workflow."
          href="/finanzas/expenses"
          cta="Open expenses"
        />
        <QuickLinkCard
          title="Reports"
          description="Operational revenue, spending, and profitability signal reports."
          href="/finanzas/reports"
          cta="Open reports"
        />
        <QuickLinkCard
          title="Accounting"
          description="Draft/posted journal review and posted General Ledger reports."
          href="/finanzas/accounting"
          cta="Open accounting"
        />
        <QuickLinkCard
          title="Taxes"
          description="Sales-tax support, tax-field quality signals, and pre-filing review."
          href="/finanzas/taxes"
          cta="Open taxes"
        />
        <QuickLinkCard
          title="Settings"
          description="Finance defaults, invoice templates, and administrative configuration."
          href="/finanzas/settings"
          cta="Open settings"
        />
      </div>

      <ContractorPayoutSummaryTable rows={reports.contractorPayoutSummary} />
    </div>
  );
}

function QuickLinkCard({ title, description, href, cta }: { title: string; description: string; href: Route; cta: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className="text-sm text-primary underline-offset-4 hover:underline">
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}
