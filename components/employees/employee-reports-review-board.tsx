'use client';

import { useActionState } from 'react';

import {
  EMPLOYEE_REPORT_STAGE_LABELS,
  TEAM_LEADER_BONUS_FINAL_DECISION_LABELS,
  TEAM_LEADER_BONUS_RECOMMENDATION_LABELS,
  TEAM_LEADER_COMPLIANCE_STATUS_LABELS,
  TEAM_LEADER_QC_CHECKPOINT_LABELS,
  TEAM_LEADER_QC_CHECKPOINT_LOG_ACTION_LABELS,
  TEAM_LEADER_QC_CHECKPOINT_STATUS_LABELS,
} from '@/config/employees';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type {
  EmployeeEventReportRecord,
  EmployeeReportEvidenceRecord,
  TeamLeaderBonusReviewItem,
  TeamLeaderQcCheckpointReviewItem,
} from '@/types/employees';
import type { EventRecord } from '@/types/events';

function formatDateTime(date: string, time: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(date)) + ` · ${String(time).slice(0, 5)}`;
}

export function EmployeeReportsReviewBoard({
  reports,
  qcCheckpoints,
  bonusReviews,
  reviewAction,
  reviewQcCheckpointAction,
  saveBonusRecommendationAction,
  finalizeBonusDecisionAction,
  canFinalizeBonus,
  discardEvidenceAction,
}: {
  reports: Array<
    EmployeeEventReportRecord & {
      events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
      profiles: { id: string; full_name: string | null };
      evidences: Array<EmployeeReportEvidenceRecord & { signed_url: string | null; uploaded_by_name: string | null }>;
    }
  >;
  qcCheckpoints: TeamLeaderQcCheckpointReviewItem[];
  bonusReviews: TeamLeaderBonusReviewItem[];
  reviewAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  reviewQcCheckpointAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  saveBonusRecommendationAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  finalizeBonusDecisionAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  canFinalizeBonus: boolean;
  discardEvidenceAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Review / aprobación / bonus release</CardTitle>
        <CardDescription>Flujo central para revisar reportes libres y checkpoints QC del Team Leader.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">Checkpoints QC por Team Leader</p>
          {qcCheckpoints.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No hay checkpoints QC en la cola actual.</div>
          ) : (
            qcCheckpoints.map((checkpoint) => (
              <QcCheckpointReviewItem key={checkpoint.id} checkpoint={checkpoint} reviewAction={reviewQcCheckpointAction} />
            ))
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-foreground">Compliance + Bonus (manual-first)</p>
          {bonusReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Sin contexto QC suficiente para evaluación manual todavía.</div>
          ) : (
            bonusReviews.map((item) => (
              <BonusReviewItem
                key={`${item.event.id}-${item.team_leader_profile.id}`}
                item={item}
                saveRecommendationAction={saveBonusRecommendationAction}
                finalizeBonusDecisionAction={finalizeBonusDecisionAction}
                canFinalizeBonus={canFinalizeBonus}
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Reportes libres de empleados</p>
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No hay reportes pendientes o recientes.</div>
        ) : (
          reports.map((report) => (
            <ReviewItem key={report.id} report={report} reviewAction={reviewAction} discardEvidenceAction={discardEvidenceAction} />
          ))
        )}
        </section>
      </CardContent>
    </Card>
  );
}

function BonusReviewItem({
  item,
  saveRecommendationAction,
  finalizeBonusDecisionAction,
  canFinalizeBonus,
}: {
  item: TeamLeaderBonusReviewItem;
  saveRecommendationAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  finalizeBonusDecisionAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  canFinalizeBonus: boolean;
}) {
  const [recommendState, recommendFormAction] = useActionState(saveRecommendationAction, initialEmployeeActionFormState);
  const [finalState, finalFormAction] = useActionState(finalizeBonusDecisionAction, initialEmployeeActionFormState);
  const recommendation = item.recommendation;

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{item.team_leader_profile.full_name ?? 'Team Leader'}</p>
        <Badge variant="outline">Compliance: {TEAM_LEADER_COMPLIANCE_STATUS_LABELS[recommendation.compliance_status]}</Badge>
        <Badge variant={recommendation.recommendation_status === 'recommended' ? 'success' : recommendation.recommendation_status === 'not_recommended' ? 'warning' : 'outline'}>
          Recomendación: {TEAM_LEADER_BONUS_RECOMMENDATION_LABELS[recommendation.recommendation_status]}
        </Badge>
        <Badge variant={recommendation.final_decision_status === 'approved' ? 'success' : recommendation.final_decision_status === 'rejected' ? 'warning' : 'outline'}>
          Owner/Main Office: {TEAM_LEADER_BONUS_FINAL_DECISION_LABELS[recommendation.final_decision_status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Evento #{item.event.id.slice(0, 8)} · {formatDateTime(item.event.event_date, item.event.event_time)} · {item.event.booked_service}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Contexto QC: {item.checkpoint_context.approved}/{item.checkpoint_context.total} aprobados · {item.checkpoint_context.observed} observados · {item.checkpoint_context.resubmitted_count} recaptura(s) · cierre final {item.checkpoint_context.final_closeout_approved ? 'aprobado' : 'pendiente'}
      </p>

      <form action={recommendFormAction} className="mt-3 grid gap-2 md:grid-cols-4">
        <input type="hidden" name="event_id" value={item.event.id} />
        <input type="hidden" name="team_leader_assignment_id" value={recommendation.team_leader_assignment_id} />
        <select name="compliance_status" defaultValue={recommendation.compliance_status} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="conforme">Conforme</option>
          <option value="con_observaciones">Con observaciones</option>
          <option value="no_conforme">No conforme</option>
        </select>
        <select name="recommendation_status" defaultValue={recommendation.recommendation_status} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="pending">Pendiente</option>
          <option value="recommended">Recomendado para bonus</option>
          <option value="not_recommended">No recomendado</option>
        </select>
        <input
          name="suggested_bonus_amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={recommendation.suggested_bonus_amount ?? ''}
          placeholder="Monto sugerido MXN"
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit">Guardar recomendación</Button>
        <input
          name="supervisor_note"
          defaultValue={recommendation.supervisor_note ?? ''}
          placeholder="Nota supervisor (manual y flexible)"
          className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-4"
        />
      </form>
      <AuthFeedback state={recommendState} />

      {canFinalizeBonus && !recommendation.id.startsWith('draft-') ? (
        <form action={finalFormAction} className="mt-3 grid gap-2 md:grid-cols-4">
          <input type="hidden" name="recommendation_id" value={recommendation.id} />
          <select name="final_decision_status" defaultValue={recommendation.final_decision_status} className="rounded-xl border bg-background px-3 py-2 text-sm">
            <option value="pending">Pendiente</option>
            <option value="approved">Liberar bonus</option>
            <option value="rejected">No liberar bonus</option>
          </select>
          <input
            name="final_bonus_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={recommendation.final_bonus_amount ?? ''}
            placeholder="Monto final MXN"
            className="rounded-xl border bg-background px-3 py-2 text-sm"
          />
          <input
            name="final_note"
            defaultValue={recommendation.final_note ?? ''}
            placeholder="Nota Owner/Main Office"
            className="rounded-xl border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <Button type="submit">Guardar decisión final</Button>
          <p className="text-xs text-muted-foreground md:col-span-4">
            Manual-first: la plataforma aporta contexto, pero la decisión final sigue siendo humana.
          </p>
        </form>
      ) : null}
      {canFinalizeBonus && !recommendation.id.startsWith('draft-') ? <AuthFeedback state={finalState} /> : null}
    </div>
  );
}

function QcCheckpointReviewItem({
  checkpoint,
  reviewAction,
}: {
  checkpoint: TeamLeaderQcCheckpointReviewItem;
  reviewAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [state, formAction] = useActionState(reviewAction, initialEmployeeActionFormState);
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{checkpoint.team_leader_profile.full_name ?? 'Team Leader'}</p>
        <Badge variant="outline">{TEAM_LEADER_QC_CHECKPOINT_LABELS[checkpoint.checkpoint_key]}</Badge>
        <Badge variant={checkpoint.status === 'approved' ? 'success' : checkpoint.status === 'observed' ? 'warning' : checkpoint.status === 'submitted' ? 'secondary' : 'outline'}>
          {TEAM_LEADER_QC_CHECKPOINT_STATUS_LABELS[checkpoint.status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Evento #{checkpoint.event.id.slice(0, 8)} · {formatDateTime(checkpoint.event.event_date, checkpoint.event.event_time)} · {checkpoint.event.booked_service}
      </p>
      <p className="mt-2 text-sm">Comentario Team Leader: {checkpoint.comment ?? 'Sin comentario.'}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Timestamp operativo: {checkpoint.recorded_at ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(checkpoint.recorded_at)) : 'Sin registrar'}
      </p>
      {checkpoint.latest_submission_kind === 'resubmitted' ? (
        <p className="mt-1 text-xs font-medium text-sky-700">Este checkpoint fue reenviado como recaptura.</p>
      ) : null}
      {checkpoint.review_notes ? <p className="mt-1 text-xs text-amber-700">Última nota supervisor: {checkpoint.review_notes}</p> : null}

      {checkpoint.evidences.length > 0 ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="font-medium">Evidencias asociadas al checkpoint:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {checkpoint.evidences.map((item) => (
              <div key={item.id} className="rounded-xl border p-2">
                <a href={item.signed_url ?? '#'} target="_blank" rel="noreferrer noopener" className="block text-primary underline">
                  {item.file_name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {item.mime_type ?? 'archivo'} · {item.created_at.slice(0, 10)} · {item.is_discarded ? 'descartada' : 'activa'}
                </p>
                <p className="text-xs text-muted-foreground">Subido por: {item.uploaded_by_name ?? item.uploaded_by.slice(0, 8)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Sin evidencias asociadas.</p>
      )}

      <form action={formAction} className="mt-3 grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="checkpoint_id" value={checkpoint.id} />
        <select name="review_status" defaultValue={checkpoint.status === 'pending' ? 'submitted' : checkpoint.status} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="submitted">Enviado / pendiente revisión</option>
          <option value="approved">Aprobar checkpoint</option>
          <option value="observed">Observar / pedir recaptura</option>
        </select>
        <input name="review_note" className="rounded-xl border bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Nota de supervisor" defaultValue={checkpoint.review_notes ?? ''} />
        <Button type="submit">Guardar revisión checkpoint</Button>
      </form>
      {checkpoint.history.length > 0 ? (
        <div className="mt-2 rounded-xl border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Historial checkpoint</p>
          <ul className="mt-1 space-y-1">
            {checkpoint.history.slice(0, 5).map((log) => (
              <li key={log.id}>
                {TEAM_LEADER_QC_CHECKPOINT_LOG_ACTION_LABELS[log.action_kind]} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.created_at))}
                {log.note ? ` · ${log.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <AuthFeedback state={state} />
    </div>
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
