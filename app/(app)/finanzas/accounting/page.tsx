import { AccountActivityTable } from '@/components/finance/account-activity-table';
import { FinanceJournalEntriesPanel } from '@/components/finance/finance-journal-entries-panel';
import { FinanceJournalEntryDetail } from '@/components/finance/finance-journal-entry-detail';
import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { GeneralLedgerTable } from '@/components/finance/general-ledger-table';
import { GLProfitLossPanel } from '@/components/finance/gl-profit-loss-panel';
import { GLReportsSummaryCards } from '@/components/finance/gl-reports-summary-cards';
import { TrialBalanceTable } from '@/components/finance/trial-balance-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getGLReportsDataset } from '@/services/finance/gl-reports';
import { getChartOfAccounts, getJournalEntries, getJournalEntryById } from '@/services/finance/queries';

export default async function FinanzasAccountingPage({
  searchParams,
}: {
  searchParams: Promise<{
    journal?: string;
    journalStatus?: string;
    glDateFrom?: string;
    glDateTo?: string;
    glAccountId?: string;
    glAccountType?: string;
    glSourceType?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedJournalId = String(resolvedSearchParams.journal ?? '').trim() || null;
  const selectedJournalStatus = String(resolvedSearchParams.journalStatus ?? '').trim();
  const journalStatusFilter = selectedJournalStatus === 'draft' || selectedJournalStatus === 'posted' || selectedJournalStatus === 'reversed'
    ? selectedJournalStatus
    : 'all';
  const glDateFrom = String(resolvedSearchParams.glDateFrom ?? '').trim() || null;
  const glDateTo = String(resolvedSearchParams.glDateTo ?? '').trim() || null;
  const glAccountId = String(resolvedSearchParams.glAccountId ?? '').trim() || null;
  const glAccountType = String(resolvedSearchParams.glAccountType ?? '').trim() || 'all';
  const glSourceType = String(resolvedSearchParams.glSourceType ?? '').trim() || 'all';

  const safeGLAccountType =
    glAccountType === 'asset'
    || glAccountType === 'liability'
    || glAccountType === 'equity'
    || glAccountType === 'income'
    || glAccountType === 'cost_of_goods_sold'
    || glAccountType === 'expense'
    || glAccountType === 'other_income'
    || glAccountType === 'other_expense'
      ? glAccountType
      : 'all';
  const safeGLSourceType =
    glSourceType === 'invoice_issue'
    || glSourceType === 'invoice_payment'
    || glSourceType === 'expense_approved'
    || glSourceType === 'payout_paid'
    || glSourceType === 'reversal'
    || glSourceType === 'adjustment'
    || glSourceType === 'opening_balance'
      ? glSourceType
      : 'all';

  const session = await requirePermission('finance.view');
  const canViewJournalEntries = Boolean(
    session.user
    && (
      hasPermission(session.user, 'finance.view')
      || (session.user.permissions as string[]).includes('finance.ledger.view')
      || (session.user.permissions as string[]).includes('finance.accounts.view')
    ),
  );
  const canPostJournalEntries = Boolean(
    session.user
    && (
      (session.user.permissions as string[]).includes('finance.ledger.post')
      || (session.user.permissions as string[]).includes('finance.accounts.manage')
      || hasPermission(session.user, 'finance.expenses.manage')
    ),
  );
  const canViewGLReports = canViewJournalEntries;

  const [journalEntries, selectedJournalDetail] = canViewJournalEntries
    ? await Promise.all([
        getJournalEntries({ status: journalStatusFilter, limit: 80 }),
        selectedJournalId ? getJournalEntryById(selectedJournalId) : Promise.resolve(null),
      ])
    : [[], null];

  const journalAccountIds = selectedJournalDetail ? [...new Set(selectedJournalDetail.lines.map((line) => line.account_id))] : [];
  const journalAccountsById = canViewJournalEntries && journalAccountIds.length > 0
    ? Object.fromEntries(
        (await getChartOfAccounts())
          .filter((account) => journalAccountIds.includes(account.id))
          .map((account) => [account.id, { code: account.code, name: account.name }]),
      ) as Record<string, { code: string; name: string }>
    : {};

  const glReports = canViewGLReports
    ? await getGLReportsDataset({
        dateFrom: glDateFrom,
        dateTo: glDateTo,
        accountId: glAccountId,
        accountType: safeGLAccountType,
        sourceType: safeGLSourceType,
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Accounting</h1>
        <p className="text-sm text-muted-foreground">Review draft journals, post approved entries, and analyze posted General Ledger activity.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Accounting overview & guardrails</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Draft journals</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Draft journals are review records and do not impact posted GL balances.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Posted entries</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Posted entries are immutable. Corrections are handled by reversal workflows in later phases.</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Operational vs GL</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Operational reports can differ from GL reports until finance workflows are fully posted.</CardContent>
          </Card>
        </div>
      </section>

      {canViewJournalEntries ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Journal review</h2>
            <p className="text-sm text-muted-foreground">Review draft/posted journals and inspect entry lines before posting a draft journal.</p>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <FinanceJournalEntriesPanel
              entries={journalEntries}
              selectedJournalId={selectedJournalId}
              selectedStatus={journalStatusFilter}
              selectedDetail={selectedJournalDetail}
            />
            {selectedJournalDetail ? (
              <FinanceJournalEntryDetail
                detail={selectedJournalDetail}
                accountsById={journalAccountsById}
                canPostJournalEntry={canPostJournalEntries}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No journal selected</CardTitle>
                  <CardDescription>Select a journal entry from the list to review detail lines and posting status.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </section>
      ) : (
        <NoAccessCard />
      )}

      {canViewGLReports && glReports ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">General Ledger reports</h2>
            <p className="text-sm text-muted-foreground">GL reports use posted journal entries only.</p>
            <p className="text-sm text-muted-foreground">Operational reports are available in the Reports tab and may differ from GL until workflows are posted.</p>
            <p className="text-sm text-muted-foreground">Opening balances remain foundational/zero until carry-forward workflows are implemented.</p>
          </div>

          <GLReportsSummaryCards
            postedLineCount={glReports.generalLedgerRows.length}
            trialBalanceDebit={glReports.trialBalanceTotals.totalDebit}
            trialBalanceCredit={glReports.trialBalanceTotals.totalCredit}
            isBalanced={glReports.trialBalanceTotals.isBalanced}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <GLProfitLossPanel profitLoss={glReports.profitLoss} />
            <TrialBalanceTable rows={glReports.trialBalanceRows} />
          </div>

          <AccountActivityTable rows={glReports.accountActivityRows} />
          <GeneralLedgerTable rows={glReports.generalLedgerRows} />
        </section>
      ) : null}
    </div>
  );
}

function NoAccessCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No access</CardTitle>
        <CardDescription>Accounting sections require ledger/accounts finance permissions.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        You need <code>finance.ledger.view</code>, <code>finance.accounts.view</code>, or broader finance access.
      </CardContent>
    </Card>
  );
}
