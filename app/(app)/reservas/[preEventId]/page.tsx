import { PreEventDetail } from '@/components/pre-events/pre-event-detail';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionContext } from '@/services/auth/session';
import { getEventByPreEventId } from '@/services/events/queries';
import { getQuoteFinancialSummary } from '@/services/finance/queries';
import { getApplicableOperationalTemplates, getEventOperationalTemplatePanelData } from '@/services/operational-templates/queries';
import { getPreEventDetailPageData } from '@/services/pre-events/queries';

export default async function PreEventDetailPage({ params }: { params: Promise<{ preEventId: string }> }) {
  const { preEventId } = await params;
  const { client, lead, preEvent, profiles, quote } = await getPreEventDetailPageData(preEventId);
  const [session, linkedEvent, financeSummary, applicableOperationalTemplates] = await Promise.all([
    getSessionContext(),
    getEventByPreEventId(preEvent.id),
    getQuoteFinancialSummary(preEvent.source_quote_id),
    getApplicableOperationalTemplates(preEvent.event_type),
  ]);
  const templatePanelData = linkedEvent ? await getEventOperationalTemplatePanelData(linkedEvent) : null;
  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view'));

  return (
    <PreEventDetail
      preEvent={preEvent}
      client={client}
      lead={lead}
      quote={quote}
      profiles={profiles}
      linkedEvent={linkedEvent}
      applicableOperationalTemplates={applicableOperationalTemplates}
      operationalTemplateApplications={templatePanelData?.applications ?? []}
      operationalTemplateProfiles={templatePanelData?.profiles ?? {}}
      financeSummary={financeSummary}
      canViewFinance={canViewFinance}
    />
  );
}
