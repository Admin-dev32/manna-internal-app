import { RemindersCenter } from '@/components/reminders/reminders-center';
import { requirePermission } from '@/lib/auth/guards';
import { getRemindersCenterData } from '@/services/reminders/queries';

export default async function NotificacionesPage() {
  await requirePermission('notifications.view');
  const reminders = await getRemindersCenterData();

  return <RemindersCenter data={reminders} />;
}
