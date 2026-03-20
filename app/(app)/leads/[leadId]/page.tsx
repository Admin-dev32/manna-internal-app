import { LeadDetail } from '@/components/leads/lead-detail';
import { getClientByLeadId } from '@/services/clients/queries';
import { getLeadDetailPageData } from '@/services/leads/queries';
import { getQuotesByLeadId } from '@/services/quotes/queries';

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const [{ activities, lead, profileMap }, quotes, client] = await Promise.all([
    getLeadDetailPageData(leadId),
    getQuotesByLeadId(leadId),
    getClientByLeadId(leadId),
  ]);

  return <LeadDetail lead={lead} activities={activities} profiles={profileMap} quotes={quotes} client={client} />;
}
