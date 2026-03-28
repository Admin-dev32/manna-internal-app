import { EventDetail } from '@/components/events/event-detail';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/services/auth/session';
import { getEventDetailPageData } from '@/services/events/queries';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requirePermission('events.view');

  const { eventId } = await params;
  const [pageData, session] = await Promise.all([getEventDetailPageData(eventId), getSessionContext()]);
  if (!pageData) {
    notFound();
  }

  const {
    event,
    client,
    lead,
    preEvent,
    quote,
    checklistItems,
    checklistProgress,
    assignments,
    tasks,
    inventoryItems,
    inventoryRequirements,
    inventoryAvailabilityByItem,
    applicableOperationalTemplates,
    operationalTemplateApplications,
    operationalTemplateProfiles,
    assignableProfiles,
    profiles,
    financeSummary,
  } = pageData;
  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view'));

  return (
    <EventDetail
      event={event}
      client={client}
      lead={lead}
      preEvent={preEvent}
      quote={quote}
      checklistItems={checklistItems}
      checklistProgress={checklistProgress}
      assignments={assignments}
      tasks={tasks}
      inventoryItems={inventoryItems}
      inventoryRequirements={inventoryRequirements}
      inventoryAvailabilityByItem={inventoryAvailabilityByItem}
      applicableOperationalTemplates={applicableOperationalTemplates}
      operationalTemplateApplications={operationalTemplateApplications}
      operationalTemplateProfiles={operationalTemplateProfiles}
      assignableProfiles={assignableProfiles}
      profiles={profiles}
      financeSummary={financeSummary}
      canViewFinance={canViewFinance}
    />
  );
}
