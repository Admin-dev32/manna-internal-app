import { BarMasterTemplatesManager } from '@/components/inventory/bar-master-templates-manager';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getBarMasterTemplatesPageData } from '@/services/bar-master-templates/queries';
import { getInventoryItems } from '@/services/inventory/queries';

export default async function BarMasterTemplatesPage() {
  const session = await requireAnyPermission(['inventory.templates.view', 'inventory.templates.manage']);

  const [{ templates, items, profiles }, inventoryItems] = await Promise.all([getBarMasterTemplatesPageData(), getInventoryItems()]);

  return (
    <BarMasterTemplatesManager
      templates={templates}
      items={items}
      inventoryItems={inventoryItems}
      profiles={profiles}
      canManage={Boolean(session.user && hasPermission(session.user, 'inventory.templates.manage'))}
    />
  );
}
