'use client';

import { useActionState } from 'react';

import { EMPLOYEE_REPORT_STAGE_LABELS } from '@/config/employees';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeEventReportRecord, EmployeeReportEvidenceRecord } from '@/types/employees';
import type { EventRecord } from '@/types/events';

function formatDateTime(date: string, time: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(date)) + ` · ${String(time).slice(0, 5)}`;
}

export function EmployeeReportsReviewBoard({
  reports,
  reviewAction,
  discardEvidenceAction,
}: {
  reports: Array<
    EmployeeEventReportRecord & {
      events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
      profiles: { id: string; full_name: string | null };
      evidences: Array<EmployeeReportEvidenceRecord & { signed_url: string | null; uploaded_by_name: string | null }>;
    }
  >;
  reviewAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  discardEvidenceAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Review / aprobación / bonus release</CardTitle>
        <CardDescription>Flujo central para revisar reportes de empleados y liberar bonus cuando corresponda.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No hay reportes pendientes o recientes.</div>
        ) : (
          reports.map((report) => (
            <ReviewItem key={report.id} report={report} reviewAction={reviewAction} discardEvidenceAction={discardEvidenceAction} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ReviewItem({
  report,
  reviewAction,
  discardEvidenceAction,
}: {
  report: EmployeeEventReportRecord & {
    events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
    profiles: { id: string; full_name: string | null };
    evidences: Array<EmployeeReportEvidenceRecord & { signed_url: string | null; uploaded_by_name: string | null }>;
  };
  reviewAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  discardEvidenceAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [state, formAction] = useActionState(reviewAction, initialEmployeeActionFormState);
  const [discardState, discardFormAction] = useActionState(discardEvidenceAction, initialEmployeeActionFormState);

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{report.profiles.full_name ?? 'Empleado'}</p>
        <Badge variant="outline">{EMPLOYEE_REPORT_STAGE_LABELS[report.report_stage]}</Badge>
        <Badge>{report.review_status.replaceAll('_', ' ')}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Evento #{report.events.id.slice(0, 8)} · {formatDateTime(report.events.event_date, report.events.event_time)} · {report.events.booked_service}
      </p>
      <p className="mt-2 text-sm">{report.status_update ?? report.service_notes ?? 'Sin detalle textual.'}</p>
      {report.evidences.length > 0 ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="font-medium">Evidencias:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {report.evidences.map((item) => (
              <div key={item.id} className="rounded-xl border p-2">
                <a href={item.signed_url ?? '#'} target="_blank" rel="noreferrer noopener" className="block text-primary underline">
                  {item.file_name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {item.mime_type ?? 'archivo'} · {item.created_at.slice(0, 10)}
                </p>
                <p className="text-xs text-muted-foreground">Subido por: {item.uploaded_by_name ?? item.uploaded_by.slice(0, 8)}</p>
                {!item.is_discarded ? (
                  <form action={discardFormAction} className="mt-2 space-y-1">
                    <input type="hidden" name="evidence_id" value={item.id} />
                    <input
                      name="discard_reason"
                      className="w-full rounded-lg border px-2 py-1 text-xs"
                      placeholder="Motivo de descarte"
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full text-xs">Descartar evidencia</Button>
                  </form>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">Descartada: {item.discard_reason ?? 'sin motivo'}.</p>
                )}
              </div>
            ))}
          </div>
          <AuthFeedback state={discardState} />
        </div>
      ) : null}

      <form action={formAction} className="mt-3 grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="report_id" value={report.id} />
        <select name="review_status" defaultValue={report.review_status} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="pendiente_revision">Pendiente revisión</option>
          <option value="en_revision">En revisión</option>
          <option value="aprobado">Aprobado</option>
          <option value="observado">Observado</option>
          <option value="requiere_correccion">Requiere corrección</option>
          <option value="bonus_liberado">Bonus liberado</option>
        </select>
        <input name="bonus_amount" type="number" min="0" step="0.01" className="rounded-xl border bg-background px-3 py-2 text-sm" placeholder="Bonus MXN (si libera)" />
        <input name="review_notes" className="rounded-xl border bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Notas de revisión / aprobación" />
        <Button type="submit" className="sm:col-span-1">Guardar revisión</Button>
      </form>
      <AuthFeedback state={state} />
    </div>
  );
}
