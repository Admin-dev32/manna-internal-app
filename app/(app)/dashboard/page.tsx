import { DashboardOverview } from '@/components/shared/dashboard-overview';
import { requirePermission } from '@/lib/auth/guards';
import { getRemindersCenterData } from '@/services/reminders/queries';

export default async function DashboardPage() {
  await requirePermission('dashboard.view');
  const reminders = await getRemindersCenterData();

  return <DashboardOverview reminders={reminders} />;
}
