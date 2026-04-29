import { FinanceSectionNav } from '@/components/finance/finance-section-nav';
import { FinancialSettingsForm } from '@/components/finance/financial-settings-form';
import { InvoiceTemplatesEntrypoint } from '@/components/finance/invoice-templates-entrypoint';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getFinancialSettings } from '@/services/finance/queries';

export default async function FinanzasSettingsPage() {
  const [session, { settings, expenses }] = await Promise.all([
    requirePermission('finance.view'),
    getFinancialSettings(),
  ]);

  const canEditDefaults = Boolean(session.user && hasPermission(session.user, 'finance.manage_defaults'));
  const canManageEmailTemplates = Boolean(session.user && hasPermission(session.user, 'settings.view'));

  return (
    <div className="flex flex-col gap-6">
      <FinanceSectionNav />

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Finance Settings</h1>
        <p className="text-sm text-muted-foreground">Manage finance defaults, invoice templates, and administrative configuration.</p>
      </section>

      {!canEditDefaults && !canManageEmailTemplates && (
        <Card>
          <CardHeader>
            <CardTitle>Limited settings access</CardTitle>
            <CardDescription>You can view this administrative area, but you do not currently have permissions to update defaults or templates.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ask an admin for <code>finance.manage_defaults</code> and/or <code>settings.view</code> if you need edit access.
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Settings overview</h2>
        <p className="text-sm text-muted-foreground">
          This area controls finance defaults and administrative configuration used across finance workflows.
        </p>
        <p className="text-sm text-muted-foreground">
          Changes here may affect future finance calculations or defaults.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Financial defaults</h2>
        <p className="text-sm text-muted-foreground">Configure default finance percentages and baseline expense templates used for new workflows.</p>
        <FinancialSettingsForm settings={settings} expenses={expenses} canEdit={canEditDefaults} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Invoice templates</h2>
        <p className="text-sm text-muted-foreground">
          Invoice templates are managed through the shared email template system.
        </p>
        <p className="text-sm text-muted-foreground">
          Invoice templates control email content only; they do not change invoice amounts or payment status.
        </p>
        <InvoiceTemplatesEntrypoint canManageTemplates={canManageEmailTemplates} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Future accounting setup note</CardTitle>
          <CardDescription>Chart of accounts and finance mappings are available in the current finance foundation.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Accounting mappings should be handled carefully when advanced management is added.
        </CardContent>
      </Card>
    </div>
  );
}
