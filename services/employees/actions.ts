'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS } from '@/config/employees';
import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import { getEmployeeAssignmentById } from '@/services/employees/queries';
import type { EmployeeReportReviewStatus, EmployeeReportStage } from '@/types/employees';

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function daysUntilEvent(eventDate: string) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(`${eventDate}T00:00:00.000Z`);
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export async function submitEmployeeEventReportAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const assignmentId = String(formData.get('assignment_id') ?? '');
  const assignment = await getEmployeeAssignmentById(assignmentId, session.user.id);
  if (!assignment) {
    return { status: 'error', message: 'No encontramos una asignación válida para tu usuario.' };
  }

  const reportStage = String(formData.get('report_stage') ?? 'actualizacion_general') as EmployeeReportStage;
  const statusUpdate = normalizeOptionalString(formData.get('status_update'));
  const serviceNotes = normalizeOptionalString(formData.get('service_notes'));
  const evidenceFiles = formData
    .getAll('evidence_files')
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, 8);

  if (!statusUpdate && !serviceNotes && evidenceFiles.length === 0) {
    return { status: 'error', message: 'Agrega al menos una actualización, nota o evidencia para guardar el reporte.' };
  }

  const { data: reportInsert, error } = await supabase
    .from('employee_event_reports')
    .insert({
      event_id: assignment.event.id,
      assignment_id: assignment.assignmentId,
      reporter_profile_id: session.user.id,
      report_stage: reportStage,
      status_update: statusUpdate,
      service_notes: serviceNotes,
      evidence_urls: [],
      review_status: 'pendiente_revision',
    })
    .select('id')
    .single();

  if (error || !reportInsert) {
    return { status: 'error', message: 'No pudimos guardar tu reporte. Intenta de nuevo.' };
  }

  const uploadErrors: string[] = [];
  for (const file of evidenceFiles) {
    const safeName = normalizeFileName(file.name || `evidencia-${Date.now()}.jpg`);
    const storagePath = `${session.user.id}/${reportInsert.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('employee-evidences').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (upload.error) {
      uploadErrors.push(file.name);
      continue;
    }

    await supabase.from('employee_report_evidences').insert({
      report_id: reportInsert.id,
      storage_bucket: 'employee-evidences',
      storage_path: storagePath,
      file_name: file.name || safeName,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      uploaded_by: session.user.id,
    });
  }

  revalidatePath('/empleados' as Route);
  if (uploadErrors.length > 0) {
    return {
      status: 'success',
      message: `Reporte enviado. Algunas evidencias no subieron (${uploadErrors.join(', ')}).`,
    };
  }

  return { status: 'success', message: 'Reporte enviado con evidencia. Queda en revisión del equipo administrativo.' };
}

export async function markEmployeeUnavailableAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const assignmentId = String(formData.get('assignment_id') ?? '');
  const assignment = await getEmployeeAssignmentById(assignmentId, session.user.id);
  if (!assignment) {
    return { status: 'error', message: 'No encontramos una asignación válida para tu usuario.' };
  }

  const daysLeft = daysUntilEvent(assignment.event.event_date);
  if (daysLeft < EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS) {
    return {
      status: 'error',
      message: `No puedes marcar inasistencia cuando faltan menos de ${EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS} días para el evento.`,
    };
  }

  const reason = normalizeOptionalString(formData.get('reason'));
  if (!reason) {
    return { status: 'error', message: 'Escribe una razón breve para avisar que no podrás asistir.' };
  }

  const { error } = await supabase.from('employee_assignment_availability').upsert(
    {
      assignment_id: assignment.assignmentId,
      event_id: assignment.event.id,
      profile_id: session.user.id,
      availability_status: 'unavailable_reported',
      reason,
      updated_by: session.user.id,
    },
    {
      onConflict: 'assignment_id,profile_id',
    },
  );

  if (error) {
    return { status: 'error', message: 'No pudimos registrar el aviso de inasistencia.' };
  }

  revalidatePath('/empleados' as Route);
  return { status: 'success', message: 'Aviso enviado. Operación lo revisará para reasignación.' };
}

export async function reviewEmployeeEventReportAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const reportId = String(formData.get('report_id') ?? '');
  if (!reportId) {
    return { status: 'error', message: 'No encontramos el reporte a revisar.' };
  }

  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (session.user.rol === 'empleado') {
    return { status: 'error', message: 'Solo gerencia puede revisar o liberar bonus.' };
  }

  const reviewStatus = String(formData.get('review_status') ?? 'aprobado') as EmployeeReportReviewStatus;
  const reviewNotes = normalizeOptionalString(formData.get('review_notes'));
  const bonusAmountRaw = normalizeOptionalString(formData.get('bonus_amount'));
  const bonusAmount = bonusAmountRaw ? Number(bonusAmountRaw) : null;

  const { error } = await supabase
    .from('employee_event_reports')
    .update({
      review_status: reviewStatus,
      review_notes: reviewNotes,
      bonus_amount: reviewStatus === 'bonus_liberado' && Number.isFinite(bonusAmount) ? bonusAmount : null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      correction_requested_at: reviewStatus === 'requiere_correccion' || reviewStatus === 'observado' ? new Date().toISOString() : null,
      bonus_released_at: reviewStatus === 'bonus_liberado' ? new Date().toISOString() : null,
    })
    .eq('id', reportId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar la revisión.' };
  }

  revalidatePath('/empleados' as Route);
  return { status: 'success', message: 'Revisión guardada correctamente.' };
}

export async function discardEmployeeEvidenceAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (session.user.rol === 'empleado') {
    return { status: 'error', message: 'Solo gerencia puede descartar evidencias.' };
  }

  const evidenceId = String(formData.get('evidence_id') ?? '');
  const discardReason = normalizeOptionalString(formData.get('discard_reason'));
  if (!evidenceId || !discardReason) {
    return { status: 'error', message: 'Debes indicar evidencia y motivo de descarte.' };
  }

  const { error } = await supabase
    .from('employee_report_evidences')
    .update({
      is_discarded: true,
      discarded_by: session.user.id,
      discarded_at: new Date().toISOString(),
      discard_reason: discardReason,
    })
    .eq('id', evidenceId);

  if (error) {
    return { status: 'error', message: 'No pudimos descartar la evidencia.' };
  }

  revalidatePath('/empleados/revision' as Route);
  revalidatePath('/eventos' as Route);
  return { status: 'success', message: 'Evidencia descartada con trazabilidad.' };
}
