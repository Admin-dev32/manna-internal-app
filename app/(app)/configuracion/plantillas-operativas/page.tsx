import { OperationalTemplatesManager } from '@/components/templates/operational-templates-manager';
import { requirePermission } from '@/lib/auth/guards';
import { getOperationalTemplatesPageData } from '@/services/operational-templates/queries';

export default async function OperationalTemplatesPage() {
  await requirePermission('settings.view');

  const { templates, checklistItems, taskItems, materialItems, profiles } = await getOperationalTemplatesPageData();

  return (
    <OperationalTemplatesManager
      templates={templates}
      checklistItems={checklistItems}
      taskItems={taskItems}
      materialItems={materialItems}
      profiles={profiles}
    />
  );
}
