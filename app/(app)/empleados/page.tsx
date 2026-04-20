import { AssistantLightPanel } from '@/components/employees/assistant-light-panel';
import { EmployeeOperationsApp } from '@/components/employees/employee-operations-app';
import { TeamLeaderExecutionPanel } from '@/components/employees/team-leader-execution-panel';
import { EmployeeTicketPanel } from '@/components/internal-tickets/employee-ticket-panel';
import { requireActiveSession, requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import {
  completeAssistantChecklistItemAction,
  markEmployeeUnavailableAction,
  respondToEventAssignmentAction,
  submitEmployeeEventReportAction,
  submitTeamLeaderCloseoutAction,
  toggleTeamLeaderChecklistItemAction,
  updateTeamLeaderExecutionStateAction,
} from '@/services/employees/actions';
import { getEmployeeAppPageData } from '@/services/employees/queries';
import { createInternalTicketAction } from '@/services/internal-tickets/actions';
import { getMyInternalTickets } from '@/services/internal-tickets/queries';

export default async function EmpleadosPage() {
  await requireAnyPermission(['employees.view', 'tasks.view']);
  const session = await requireActiveSession();
  if (!session.user) return null;

  const [appData, myTickets] = await Promise.all([
    getEmployeeAppPageData(session.user.id),
    getMyInternalTickets(session.user.id),
  ]);
  const canCreateInternalTickets = hasPermission(session.user, 'internal_tickets.create');

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {appData.teamLeaderExecution ? (
        <TeamLeaderExecutionPanel
          context={appData.teamLeaderExecution}
          updateExecutionAction={updateTeamLeaderExecutionStateAction}
          toggleChecklistAction={toggleTeamLeaderChecklistItemAction}
          submitCloseoutAction={submitTeamLeaderCloseoutAction}
        />
      ) : null}
      {appData.assistantLight ? (
        <AssistantLightPanel
          context={appData.assistantLight}
          completeChecklistAction={completeAssistantChecklistItemAction}
        />
      ) : null}
      <EmployeeOperationsApp
        employeeName={session.user.nombre}
        todayAssignment={appData.todayAssignment}
        upcomingAssignments={appData.upcomingAssignments}
        projectedTodayMxn={appData.projectedTodayMxn}
        projectedTotalMxn={appData.projectedTotalMxn}
        releasedBonusMxn={appData.releasedBonusMxn}
        recentReports={appData.recentReports}
        recentReportEvidences={appData.recentReportEvidences}
        submitReportAction={submitEmployeeEventReportAction}
        markUnavailableAction={markEmployeeUnavailableAction}
        respondAssignmentAction={respondToEventAssignmentAction}
      />
      {canCreateInternalTickets ? (
        <EmployeeTicketPanel
          myTickets={myTickets}
          availableAssignments={[...(appData.todayAssignment ? [appData.todayAssignment] : []), ...appData.upcomingAssignments]}
          createTicketAction={createInternalTicketAction}
        />
      ) : null}
    </div>
  );
}
