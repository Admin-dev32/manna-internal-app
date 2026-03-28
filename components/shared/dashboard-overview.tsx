import { AlertBanner } from '@/components/shared/alert-banner';
import { RemindersDashboardPanel } from '@/components/reminders/reminders-dashboard-panel';
import type { ReminderCenterData } from '@/types/reminders';

export function DashboardOverview({ reminders }: { reminders: ReminderCenterData }) {
  return (
    <div className="flex flex-col gap-6">
      <AlertBanner
        title="Recordatorios internos sin automatizaciones complejas"
        description="La app ahora calcula pendientes al consultar datos y deja una base limpia para crecer después a emails internos, recordatorios programados y automatizaciones más fuertes."
      />

      <RemindersDashboardPanel data={reminders} />
    </div>
  );
}
