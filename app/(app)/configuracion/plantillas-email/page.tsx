import { EmailTemplatesManager } from '@/components/settings/email-templates-manager';
import { requirePermission } from '@/lib/auth/guards';
import { getEmailTemplates } from '@/services/email-templates/queries';

export default async function EmailTemplatesPage() {
  await requirePermission('settings.view');
  const templates = await getEmailTemplates();

  return <EmailTemplatesManager templates={templates} />;
}
