import { InventoryOverview } from '@/components/inventory/inventory-overview';
import { requirePermission } from '@/lib/auth/guards';
import { getInventoryOverviewPageData } from '@/services/inventory/queries';

export default async function InventarioPage() {
  await requirePermission('inventory.view');

  const pageData = await getInventoryOverviewPageData();

  return <InventoryOverview items={pageData.items} availabilityByItem={pageData.availabilityByItem} profiles={pageData.profiles} />;
}
