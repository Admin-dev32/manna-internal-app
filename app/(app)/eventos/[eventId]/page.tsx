import { EventDetail } from '@/components/events/event-detail';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionContext } from '@/services/auth/session';
import { getEventDetailPageData } from '@/services/events/queries';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [{ event, client, lead, preEvent, quote, profiles, financeSummary }, session] = await Promise.all([
    getEventDetailPageData(eventId),
    getSessionContext(),
  ]);
  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view'));

  return (
    <EventDetail
      event={event}
      client={client}
      lead={lead}
      preEvent={preEvent}
      quote={quote}
      profiles={profiles}
      financeSummary={financeSummary}
      canViewFinance={canViewFinance}
    />
  );
}
