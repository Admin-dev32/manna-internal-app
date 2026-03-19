import { LeadsList } from '@/components/leads/leads-list';
import { getLeadsPageData } from '@/services/leads/queries';

export default async function LeadsPage() {
  const { leads, profiles, summary } = await getLeadsPageData();

  return <LeadsList leads={leads} profiles={profiles} summary={summary} />;
}
