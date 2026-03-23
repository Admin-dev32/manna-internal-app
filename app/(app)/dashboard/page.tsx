import { DashboardOverview } from '@/components/shared/dashboard-overview';
import { getRemindersCenterData } from '@/services/reminders/queries';

export default async function DashboardPage() {
  const reminders = await getRemindersCenterData();

  return <DashboardOverview reminders={reminders} />;
}
