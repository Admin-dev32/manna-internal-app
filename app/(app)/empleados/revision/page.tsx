import { EmployeeReportsReviewBoard } from '@/components/employees/employee-reports-review-board';
import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { discardEmployeeEvidenceAction, reviewEmployeeEventReportAction } from '@/services/employees/actions';
import { getEmployeeReviewFilterOptions, getEmployeeReviewQueuePageData } from '@/services/employees/queries';

export default async function EmployeeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reporter?: string; event?: string; recent_days?: string }>;
}) {
  await requirePermission('employees.view');
  const session = await requireActiveSession();
  if (!session.user || session.user.rol === 'empleado') return null;

  const params = await searchParams;
  const [reviewQueue, filterOptions] = await Promise.all([
    getEmployeeReviewQueuePageData({
      status: params.status,
      reporterProfileId: params.reporter,
      eventId: params.event,
      recentDays: params.recent_days,
    }),
    getEmployeeReviewFilterOptions(),
  ]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <form className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-4">
        <select name="status" defaultValue={params.status ?? 'todos'} className="rounded-xl border px-3 py-2 text-sm">
          <option value="todos">Todos los estados</option>
          <option value="pendiente_revision">Pendiente revisión</option>
          <option value="en_revision">En revisión</option>
          <option value="aprobado">Aprobado</option>
          <option value="observado">Observado</option>
          <option value="requiere_correccion">Requiere corrección</option>
          <option value="bonus_liberado">Bonus liberado</option>
        </select>
        <select name="reporter" defaultValue={params.reporter ?? 'todos'} className="rounded-xl border px-3 py-2 text-sm">
          <option value="todos">Todos los empleados</option>
          {filterOptions.reporters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name ?? item.id}
            </option>
          ))}
        </select>
        <select name="event" defaultValue={params.event ?? 'todos'} className="rounded-xl border px-3 py-2 text-sm">
          <option value="todos">Todos los eventos</option>
          {filterOptions.events.map((item) => (
            <option key={item.id} value={item.id}>
              {(item.event_type ?? 'Evento')} · {item.event_date}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select name="recent_days" defaultValue={params.recent_days ?? '30'} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="todos">Sin límite</option>
          </select>
          <button type="submit" className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Filtrar</button>
        </div>
      </form>
      <EmployeeReportsReviewBoard
        reports={reviewQueue}
        reviewAction={reviewEmployeeEventReportAction}
        discardEvidenceAction={discardEmployeeEvidenceAction}
      />
    </div>
  );
}
