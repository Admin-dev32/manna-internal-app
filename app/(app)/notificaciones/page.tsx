import { RemindersCenter } from '@/components/reminders/reminders-center';
import { getRemindersCenterData } from '@/services/reminders/queries';

export default async function NotificacionesPage() {
  const reminders = await getRemindersCenterData();

  return <RemindersCenter data={reminders} />;
}
