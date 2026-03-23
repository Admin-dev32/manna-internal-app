import { TasksOverview } from '@/components/tasks/tasks-overview';
import { requirePermission } from '@/lib/auth/guards';
import { getTasksOverviewPageData } from '@/services/tasks/queries';

export default async function TareasPage() {
  await requirePermission('tasks.view');

  const pageData = await getTasksOverviewPageData();

  return <TasksOverview tasks={pageData.tasks} events={pageData.events} clients={pageData.clients} profiles={pageData.profiles} />;
}
