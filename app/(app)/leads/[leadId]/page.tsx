import { LeadDetail } from '@/components/leads/lead-detail';
import { getLeadDetailPageData } from '@/services/leads/queries';

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { activities, lead, profileMap } = await getLeadDetailPageData(leadId);

  return <LeadDetail lead={lead} activities={activities} profiles={profileMap} />;
}
