import { FinanceInvoiceDetailPanel } from '@/components/finance/finance-invoice-detail';
import { FinanceInvoicesList } from '@/components/finance/finance-invoices-list';
import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { InvoiceAgingPanel } from '@/components/finance/invoice-aging-panel';
import { InvoiceFollowUpList } from '@/components/finance/invoice-follow-up-list';
import { InvoiceKpiCards } from '@/components/finance/invoice-kpi-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { searchManualInvoiceClients } from '@/services/clients/queries';
import { getActiveChartOfAccounts } from '@/services/finance/queries';
import {
  getFinanceInvoiceAgingSummary,
  getFinanceInvoiceById,
  getFinanceInvoices,
  getInvoiceEmailDeliveriesByInvoiceId,
  getInvoicePaymentSummaryByInvoiceId,
  getInvoicePaymentsByInvoiceId,
} from '@/services/invoices/queries';

export default async function FinanzasInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedInvoiceId = String(resolvedSearchParams.invoice ?? '').trim() || null;

  const [session, financeInvoices, invoiceAgingSummary, manualInvoiceClients] = await Promise.all([
    requirePermission('finance.view'),
    getFinanceInvoices({ limit: 120 }),
    getFinanceInvoiceAgingSummary(),
    searchManualInvoiceClients('', 80),
  ]);

  const canViewInvoices = Boolean(session.user && (hasPermission(session.user, 'finance.invoices.view') || hasPermission(session.user, 'finance.invoices.manage')));
  const canManageInvoices = Boolean(session.user && hasPermission(session.user, 'finance.invoices.manage'));
  const canManagePayments = Boolean(
    session.user && (hasPermission(session.user, 'finance.invoices.manage') || (session.user.permissions as string[]).includes('finance.payments.manage')),
  );

  const selectedInvoiceDetail = canViewInvoices && selectedInvoiceId ? await getFinanceInvoiceById(selectedInvoiceId) : null;
  const [selectedInvoiceDeliveries, selectedInvoicePayments, selectedInvoicePaymentSummary, depositAccounts] = selectedInvoiceDetail
    ? await Promise.all([
        getInvoiceEmailDeliveriesByInvoiceId(selectedInvoiceDetail.invoice.id),
        getInvoicePaymentsByInvoiceId(selectedInvoiceDetail.invoice.id),
        getInvoicePaymentSummaryByInvoiceId(selectedInvoiceDetail.invoice.id),
        canManagePayments
          ? getActiveChartOfAccounts().then((accounts) => accounts.filter((account) => account.active).map((account) => ({
              id: account.id,
              code: account.code,
              name: account.name,
            })))
          : Promise.resolve([]),
      ])
    : [[], [], { totalPaidSucceeded: 0, totalFees: 0, totalNet: 0, paymentCount: 0, latestPaymentDate: null }, []];

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">Manage invoices, payment records, email delivery, aging, and follow-up.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Invoice guardrails</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Payment links vs payments</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Payment links indicate intent and delivery context, not confirmed payment settlement.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Manual payment records</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Manual payments are canonical records but do not sync invoice balance/status automatically in this phase.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Operational workflow</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Use this workspace for operational tracking while ledger posting workflows continue maturing.</CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Invoice overview</h2>
        <InvoiceKpiCards summary={invoiceAgingSummary} />
        <div className="grid gap-6 xl:grid-cols-2">
          <InvoiceAgingPanel summary={invoiceAgingSummary} />
          <InvoiceFollowUpList summary={invoiceAgingSummary} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Invoice workspace</h2>
        <div className="grid gap-6 2xl:grid-cols-[1fr_1.1fr]">
          <FinanceInvoicesList invoices={financeInvoices} canView={canViewInvoices} canManage={canManageInvoices} manualInvoiceClients={manualInvoiceClients} />
          {canViewInvoices ? (
            selectedInvoiceDetail ? (
              <FinanceInvoiceDetailPanel
                detail={selectedInvoiceDetail}
                deliveries={selectedInvoiceDeliveries}
                canManageInvoices={canManageInvoices}
                payments={selectedInvoicePayments}
                paymentSummary={selectedInvoicePaymentSummary}
                canManagePayments={canManagePayments}
                depositAccounts={depositAccounts}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No invoice selected</CardTitle>
                  <CardDescription>Select an invoice from the list to open detail, payments, email, and payment-link context.</CardDescription>
                </CardHeader>
              </Card>
            )
          ) : null}
        </div>
      </section>

      {!canViewInvoices ? (
        <Card>
          <CardHeader>
            <CardTitle>No access</CardTitle>
            <CardDescription>Invoice data requires invoice permissions in finance scope.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You need <code>finance.invoices.view</code> or <code>finance.invoices.manage</code>.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
