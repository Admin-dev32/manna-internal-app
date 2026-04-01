'use client';

import { useActionState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { CalendarDays, Camera, CircleDollarSign, ClipboardCheck, Clock3, MapPin, ShieldAlert } from 'lucide-react';

import { EMPLOYEE_REPORT_STAGE_LABELS, EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS } from '@/config/employees';
import { EVENT_ASSIGNMENT_ROLE_LABELS, EVENT_ASSIGNMENT_STATUS_LABELS, EVENT_STATUS_LABELS } from '@/config/events';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeAssignedEvent, EmployeeEventReportRecord, EmployeeReportEvidenceRecord } from '@/types/employees';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value));
}

function getLocationSummary(location: string | null) {
  const normalized = String(location ?? '').trim();
  if (!normalized) return 'Ubicación pendiente';
  return normalized.length > 42 ? `${normalized.slice(0, 42)}…` : normalized;
}

function formatDateTime(date: string, time: string) {
  return `${formatDate(date)} · ${String(time).slice(0, 5)}`;
}

function daysUntil(eventDate: string) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(`${eventDate}T00:00:00.000Z`);
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

function Money({ amount }: { amount: number }) {
  return <>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)}</>;
}

export function EmployeeOperationsApp({
  employeeName,
  todayAssignment,
  upcomingAssignments,
  projectedTodayMxn,
  projectedTotalMxn,
  releasedBonusMxn,
  recentReports,
  recentReportEvidences,
  submitReportAction,
  markUnavailableAction,
}: {
  employeeName: string;
  todayAssignment: EmployeeAssignedEvent | null;
  upcomingAssignments: EmployeeAssignedEvent[];
  projectedTodayMxn: number;
  projectedTotalMxn: number;
  releasedBonusMxn: number;
  recentReports: EmployeeEventReportRecord[];
  recentReportEvidences: Record<string, Array<EmployeeReportEvidenceRecord & { signed_url: string | null }>>;
  submitReportAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  markUnavailableAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-10">
      <section className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-sm text-slate-300">App de campo</p>
        <h1 className="mt-1 text-3xl font-semibold">Hola, {employeeName}</h1>
        <p className="mt-2 text-sm text-slate-300">Vista mobile-first conectada al sistema administrativo central.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={CircleDollarSign} label="Proyección hoy" value={<Money amount={projectedTodayMxn} />} />
        <MetricCard icon={CalendarDays} label="Próximos asignados" value={String(upcomingAssignments.length)} />
        <MetricCard icon={ClipboardCheck} label="Bonus liberado" value={<Money amount={releasedBonusMxn} />} />
      </section>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Evento asignado de hoy</CardTitle>
          <CardDescription>Resumen operativo para iniciar turno rápido.</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAssignment ? (
            <EventBigBlock assignment={todayAssignment} locationSummary={getLocationSummary(todayAssignment.event.location)} />
          ) : (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Hoy no tienes evento asignado.</div>
          )}
        </CardContent>
      </Card>

      {todayAssignment ? (
        <EmployeeReportComposer
          title="Reporte rápido del evento de hoy"
          assignment={todayAssignment}
          submitAction={submitReportAction}
          unavailableAction={markUnavailableAction}
        />
      ) : null}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Próximos eventos asignados</CardTitle>
          <CardDescription>Planifica tu operación de los siguientes días.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No tienes próximos eventos asignados.</div>
          ) : (
            upcomingAssignments.map((assignment) => (
              <div key={assignment.assignmentId} className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-semibold">{assignment.event.event_type ?? 'Evento'} · {formatDateTime(assignment.event.event_date, assignment.event.event_time)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{assignment.event.booked_service} · {getLocationSummary(assignment.event.location)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{EVENT_ASSIGNMENT_ROLE_LABELS[assignment.assignmentRole]}</Badge>
                  <Badge variant={assignment.assignmentStatus === 'confirmado' ? 'success' : 'warning'}>
                    {EVENT_ASSIGNMENT_STATUS_LABELS[assignment.assignmentStatus]}
                  </Badge>
                </div>
                <div className="mt-3">
                  <EmployeeReportComposer
                    compact
                    title="Actualizar avance"
                    assignment={assignment}
                    submitAction={submitReportAction}
                    unavailableAction={markUnavailableAction}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Estimado preliminar de operación (no pago final)</CardTitle>
          <CardDescription>
            Referencia operativa de asignaciones reales. Siempre está sujeto a revisión, validación y cierre administrativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Estimado preliminar del periodo visible: <span className="font-semibold text-foreground"><Money amount={projectedTotalMxn} /></span></p>
          <p className="mt-1">No representa pago garantizado ni monto final aprobado.</p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Tus últimos reportes enviados</CardTitle>
          <CardDescription>Estado de revisión dentro del sistema central.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Aún no has enviado reportes.</div>
          ) : (
            recentReports.map((report) => (
              <div key={report.id} className="rounded-2xl border bg-background p-3 text-sm">
                <p className="font-medium">{EMPLOYEE_REPORT_STAGE_LABELS[report.report_stage]}</p>
                <p className="text-muted-foreground">{report.status_update ?? report.service_notes ?? 'Sin texto adicional'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Revisión: {report.review_status.replaceAll('_', ' ')}</p>
                {report.review_notes ? <p className="mt-1 text-xs text-amber-700">Observación: {report.review_notes}</p> : null}
                {report.correction_requested_at ? <p className="mt-1 text-xs text-amber-700">Corrección solicitada: {report.correction_requested_at.slice(0, 10)}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">Evidencias: {recentReportEvidences[report.id]?.length ?? 0}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="size-5" /></div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EventBigBlock({ assignment, locationSummary }: { assignment: EmployeeAssignedEvent; locationSummary: string }) {
  return (
    <div className="space-y-3 rounded-3xl border bg-background p-5">
      <p className="text-lg font-semibold">{assignment.event.event_type ?? 'Evento'} #{assignment.event.id.slice(0, 8)}</p>
      <Row icon={Clock3} text={formatDateTime(assignment.event.event_date, assignment.event.event_time)} />
      <Row icon={MapPin} text={locationSummary} />
      <Row icon={ClipboardCheck} text={assignment.event.booked_service} />
      <div className="flex flex-wrap gap-2">
        <Badge>{EVENT_ASSIGNMENT_ROLE_LABELS[assignment.assignmentRole]}</Badge>
        <Badge variant="outline">{EVENT_STATUS_LABELS[assignment.event.status]}</Badge>
      </div>
    </div>
  );
}

function Row({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="size-4" />
      <span>{text}</span>
    </div>
  );
}

function EmployeeReportComposer({
  title,
  assignment,
  submitAction,
  unavailableAction,
  compact = false,
}: {
  title: string;
  assignment: EmployeeAssignedEvent;
  submitAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  unavailableAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  compact?: boolean;
}) {
  const [reportState, reportFormAction] = useActionState(submitAction, initialEmployeeActionFormState);
  const [unavailableState, unavailableFormAction] = useActionState(unavailableAction, initialEmployeeActionFormState);
  const daysLeft = daysUntil(assignment.event.event_date);
  const cannotMarkUnavailable = daysLeft < EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="font-semibold">{title}</p>
      <form action={reportFormAction} className="space-y-2">
        <input type="hidden" name="assignment_id" value={assignment.assignmentId} />
        <label className="text-sm">Módulo operativo</label>
        <select name="report_stage" defaultValue="actualizacion_general" className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
          {Object.entries(EMPLOYEE_REPORT_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <textarea name="status_update" rows={compact ? 2 : 3} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder="Actualización breve del avance." />
        <textarea name="service_notes" rows={compact ? 2 : 3} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder="Información relevante del servicio." />
        <input name="evidence_files" type="file" multiple accept="image/*,application/pdf" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">Puedes subir múltiples fotos/evidencias directamente desde tu dispositivo.</p>
        <Button type="submit" className="w-full sm:w-auto">
          <Camera className="size-4" />
          Enviar reporte y evidencia
        </Button>
        <AuthFeedback state={reportState} />
      </form>

      <form action={unavailableFormAction} className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <input type="hidden" name="assignment_id" value={assignment.assignmentId} />
        <p className="text-sm font-medium text-amber-900">Avisar que no podré asistir</p>
        <textarea
          name="reason"
          rows={2}
          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
          placeholder="Explica brevemente el motivo."
          disabled={cannotMarkUnavailable}
        />
        <Button type="submit" variant="outline" className="border-amber-300 bg-white" disabled={cannotMarkUnavailable}>
          <ShieldAlert className="size-4" />
          Enviar aviso de inasistencia
        </Button>
        {cannotMarkUnavailable ? (
          <p className="text-xs text-amber-800">
            Bloqueado: faltan {Math.max(daysLeft, 0)} días. Solo se permite avisar con {EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS} días o más.
          </p>
        ) : null}
        <AuthFeedback state={unavailableState} />
      </form>
    </div>
  );
}
