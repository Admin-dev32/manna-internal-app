import { AlertBanner } from '@/components/shared/alert-banner';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { RemindersDashboardPanel } from '@/components/reminders/reminders-dashboard-panel';
import type { ReminderCenterData } from '@/types/reminders';

export function DashboardOverview({ reminders }: { reminders: ReminderCenterData }) {
  return (
    <ModulePageLayout
      badge="Operación diaria"
      title="Centro de control"
      description="Prioriza seguimientos, pendientes operativos y alertas internas desde una vista unificada para el equipo."
      breadcrumbs={[{ label: 'Inicio' }, { label: 'Dashboard' }]}
    >
      <AlertBanner
        title="Recordatorios internos sin automatizaciones complejas"
        description="La app ahora calcula pendientes al consultar datos y deja una base limpia para crecer después a emails internos, recordatorios programados y automatizaciones más fuertes."
      />

      <RemindersDashboardPanel data={reminders} />
    </ModulePageLayout>
  );
}
