import { ExpensesModule } from '@/components/finance/expenses-module';
import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getFinancialExpenses } from '@/services/finance/queries';

export default async function FinanzasExpensesPage() {
  const [session, expensesModuleData] = await Promise.all([
    requirePermission('finance.view'),
    getFinancialExpenses(),
  ]);

  const canViewExpenses = Boolean(
    session.user
    && (
      hasPermission(session.user, 'finance.expenses.view')
      || hasPermission(session.user, 'finance.expenses.manage')
      || hasPermission(session.user, 'finance.expenses.approve')
    ),
  );
  const canManageExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.manage'));
  const canApproveExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.approve'));

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground">Track spending, receipts, event costs, categories, and approval status.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense workspace</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Capture expense details, classify categories, and review status in one workflow.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipts & approval context</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Receipts support recordkeeping and approval review; they do not automatically make an expense deductible.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event-linked spending context</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Event-linked expenses support profitability tracking by event and operational reporting alignment.
          </CardContent>
        </Card>
      </div>

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
  );
}
