import { BusinessSettingsForm } from '@/components/settings/business-settings-form';
import { requirePermission } from '@/lib/auth/guards';
import { getBusinessSettings } from '@/services/business-settings/queries';

export default async function BusinessSettingsPage() {
  await requirePermission('settings.view');
  const settings = await getBusinessSettings();

  return <BusinessSettingsForm settings={settings} />;
}
