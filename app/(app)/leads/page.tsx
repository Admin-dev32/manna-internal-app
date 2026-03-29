import { LeadsList } from '@/components/leads/leads-list';
import { requirePermission } from '@/lib/auth/guards';
import { getLeadsPageData } from '@/services/leads/queries';

export default async function LeadsPage() {
  await requirePermission('crm.view');
  const { leads, profiles, summary } = await getLeadsPageData();

  return <LeadsList leads={leads} profiles={profiles} summary={summary} />;
}
