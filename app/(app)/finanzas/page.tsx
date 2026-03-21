import { FinancialSettingsForm } from '@/components/finance/financial-settings-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { getFinancialSettings } from '@/services/finance/queries';

export default async function FinanzasPage() {
  const [session, { settings, expenses }] = await Promise.all([requirePermission('finance.view'), getFinancialSettings()]);
  const canEditDefaults = session.user?.rol === 'owner';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Finanzas internas</Badge>
          <Badge className="bg-white/10 text-white">{canEditDefaults ? 'Owner editable' : 'Acceso restringido'}</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Defaults globales financieros</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Configura tax reserve, comisión y gastos opcionales que servirán como punto de partida para nuevas hojas financieras ligadas a cotizaciones.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <FinancialSettingsForm settings={settings} expenses={expenses} canEdit={canEditDefaults} />
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
                <p className="font-medium text-foreground">Crecimiento futuro</p>
                <p className="mt-2">Reservas ya nacen desde `source_quote_id`, así que más adelante pueden consumir la misma hoja o derivar una extensión operativa sin duplicar lógica.</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <p className="font-medium text-foreground">Protección</p>
                <p className="mt-2">Esta pantalla exige `finance.view`. Owner tiene acceso completo; manager accede según el permiso asignado; empleado no entra.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
