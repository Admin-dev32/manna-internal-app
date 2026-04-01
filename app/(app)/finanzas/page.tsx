import { ExpensesModule } from '@/components/finance/expenses-module';
import { FinancialSettingsForm } from '@/components/finance/financial-settings-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getFinancialExpenses, getFinancialSettings } from '@/services/finance/queries';

export default async function FinanzasPage() {
  const [session, { settings, expenses }, expensesModuleData] = await Promise.all([
    requirePermission('finance.view'),
    getFinancialSettings(),
    getFinancialExpenses(),
  ]);

  const canEditDefaults = Boolean(session.user && hasPermission(session.user, 'finance.manage_defaults'));
  const canViewExpenses = Boolean(
    session.user &&
      (hasPermission(session.user, 'finance.expenses.view') || hasPermission(session.user, 'finance.expenses.manage') || hasPermission(session.user, 'finance.expenses.approve')),
  );
  const canManageExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.manage'));
  const canApproveExpenses = Boolean(session.user && hasPermission(session.user, 'finance.expenses.approve'));

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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <FinancialSettingsForm settings={settings} expenses={expenses} canEdit={canEditDefaults} />
          <ExpensesModule
            expenses={expensesModuleData.expenses}
            eventOptions={expensesModuleData.eventOptions}
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
