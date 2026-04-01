import { EventDetail } from '@/components/events/event-detail';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/services/auth/session';
import { getEventDetailPageData } from '@/services/events/queries';
import { getFinancialExpensesByEventId } from '@/services/finance/queries';

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
    recurringTaskRules,
    inventoryItems,
    inventoryRequirements,
    inventoryAvailabilityByItem,
    barMasterTemplates,
    barMasterTemplateApplications,
    applicableOperationalTemplates,
    operationalTemplateApplications,
    operationalTemplateProfiles,
    assignableProfiles,
    profiles,
    financeSummary,
    calendarSync,
    operationalHubStatus,
    operationalSignals,
    employeeReports,
    reportEvidencesByReport,
    availabilityRows,
  } = pageData;
  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view_event_summary'));
  const canViewTasks = Boolean(session.user && hasPermission(session.user, 'tasks.view'));
  const canManageTasks = Boolean(session.user && hasPermission(session.user, 'tasks.manage'));
  const canAssignTasks = Boolean(session.user && hasPermission(session.user, 'tasks.assign'));
  const canUpdateTaskStatus = Boolean(session.user && hasPermission(session.user, 'tasks.update_status'));
  const canViewChat = Boolean(session.user && hasPermission(session.user, 'chat.view'));
  const canViewInventory = Boolean(session.user && hasPermission(session.user, 'inventory.view'));
  const canPrepareInventory = Boolean(session.user && (hasPermission(session.user, 'inventory.prepare') || hasPermission(session.user, 'inventory.manage')));
  const canViewExpenses = Boolean(
    session.user &&
      (hasPermission(session.user, 'finance.expenses.view') || hasPermission(session.user, 'finance.expenses.manage') || hasPermission(session.user, 'finance.expenses.approve')),
  );

  const eventExpenses = canViewExpenses ? await getFinancialExpensesByEventId(event.id) : [];

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
      tasks={canViewTasks ? tasks : []}
      recurringTaskRules={canViewTasks ? recurringTaskRules : []}
      canViewTasks={canViewTasks}
      canManageTasks={canManageTasks}
      canAssignTasks={canAssignTasks}
      canUpdateTaskStatus={canUpdateTaskStatus}
      canViewChat={canViewChat}
      canViewInventory={canViewInventory}
      canPrepareInventory={canPrepareInventory}
      inventoryItems={inventoryItems}
      inventoryRequirements={inventoryRequirements}
      inventoryAvailabilityByItem={inventoryAvailabilityByItem}
      barMasterTemplates={barMasterTemplates}
      barMasterTemplateApplications={barMasterTemplateApplications}
      applicableOperationalTemplates={applicableOperationalTemplates}
      operationalTemplateApplications={operationalTemplateApplications}
      operationalTemplateProfiles={operationalTemplateProfiles}
      assignableProfiles={assignableProfiles}
      profiles={profiles}
      financeSummary={financeSummary}
      canViewFinance={canViewFinance}
      canViewExpenses={canViewExpenses}
      eventExpenses={eventExpenses}
      calendarSync={calendarSync}
      operationalHubStatus={operationalHubStatus}
      operationalSignals={operationalSignals}
      employeeReports={employeeReports}
      reportEvidencesByReport={reportEvidencesByReport}
      availabilityRows={availabilityRows}
    />
  );
}
