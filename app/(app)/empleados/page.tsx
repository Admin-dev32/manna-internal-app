import { EmployeeOperationsApp } from '@/components/employees/employee-operations-app';
import { requireActiveSession, requireAnyPermission } from '@/lib/auth/guards';
import { submitEmployeeEventReportAction, markEmployeeUnavailableAction } from '@/services/employees/actions';
import { getEmployeeAppPageData } from '@/services/employees/queries';

export default async function EmpleadosPage() {
  await requireAnyPermission(['employees.view', 'tasks.view']);
  const session = await requireActiveSession();
  if (!session.user) return null;

  const appData = await getEmployeeAppPageData(session.user.id);

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
      />
    </div>
  );
}
