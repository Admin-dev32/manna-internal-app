'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS } from '@/config/employees';
import { TEAM_LEADER_QC_CHECKPOINT_LABELS, TEAM_LEADER_QC_CHECKPOINT_SEQUENCE, TEAM_LEADER_QC_CHECKPOINT_TO_REPORT_STAGE } from '@/config/employees';
import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import { getEmployeeAssignmentById } from '@/services/employees/queries';
import type {
  EmployeeReportReviewStatus,
  EmployeeReportStage,
  TeamLeaderBonusFinalDecisionStatus,
  TeamLeaderBonusRecommendationStatus,
  TeamLeaderComplianceStatus,
  TeamLeaderQcCheckpointKey,
} from '@/types/employees';
import type { EventInventoryCloseoutStatus } from '@/types/inventory';

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

async function getTeamLeaderExecutionAssignment(profileId: string, eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, assignment_role, assignment_status, is_team_leader_responsible')
    .eq('profile_id', profileId)
    .eq('event_id', eventId)
    .maybeSingle();

  const assignment = data as {
    id: string;
    assignment_role: string;
    assignment_status: string;
    is_team_leader_responsible: boolean;
  } | null;

  if (!assignment) return null;
  if (assignment.assignment_status !== 'accepted' && assignment.assignment_status !== 'confirmado') return null;

  const isTeamLeaderContext =
    assignment.assignment_role === 'team_leader' || assignment.assignment_role === 'lider' || assignment.is_team_leader_responsible;
  return isTeamLeaderContext ? assignment : null;
}

async function getAssistantExecutionAssignment(profileId: string, eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, assignment_role, assignment_status')
    .eq('profile_id', profileId)
    .eq('event_id', eventId)
    .maybeSingle();

  const assignment = data as {
    id: string;
    assignment_role: string;
    assignment_status: string;
  } | null;

  if (!assignment) return null;
  if (assignment.assignment_status !== 'accepted' && assignment.assignment_status !== 'confirmado') return null;

  const isAssistantContext = assignment.assignment_role === 'assistant' || assignment.assignment_role === 'apoyo';
  return isAssistantContext ? assignment : null;
}

function normalizeNonNegativeNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 0;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function normalizeExecutionStatus(track: 'shopping' | 'picking', value: string) {
  if (track === 'shopping') {
    return value === 'pending' || value === 'bought' ? value : null;
  }
  return value === 'pending' || value === 'pulled' ? value : null;
}

function normalizeComplianceStatus(value: string): TeamLeaderComplianceStatus | null {
  return value === 'conforme' || value === 'con_observaciones' || value === 'no_conforme' ? value : null;
}

function normalizeRecommendationStatus(value: string): TeamLeaderBonusRecommendationStatus | null {
  return value === 'recommended' || value === 'not_recommended' || value === 'pending' ? value : null;
}

function normalizeFinalDecisionStatus(value: string): TeamLeaderBonusFinalDecisionStatus | null {
  return value === 'pending' || value === 'approved' || value === 'rejected' ? value : null;
}

function isTeamLeaderQcCheckpointKey(value: string): value is TeamLeaderQcCheckpointKey {
  return TEAM_LEADER_QC_CHECKPOINT_SEQUENCE.some((key) => key === value);
}

async function ensureTeamLeaderQcCheckpoints(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  eventId: string,
  assignmentId: string,
) {
  const payload = TEAM_LEADER_QC_CHECKPOINT_SEQUENCE.map((checkpointKey, index) => ({
    event_id: eventId,
    team_leader_assignment_id: assignmentId,
    checkpoint_key: checkpointKey,
    status: 'pending',
    order_index: index + 1,
  }));
  await supabase.from('team_leader_qc_checkpoints').upsert(payload, { onConflict: 'event_id,team_leader_assignment_id,checkpoint_key' });
}

async function appendCheckpointLog(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  payload: {
    checkpointId: string;
    eventId: string;
    assignmentId: string;
    statusSnapshot: 'pending' | 'submitted' | 'approved' | 'observed';
    actionKind: 'submitted' | 'observed' | 'resubmitted' | 'approved' | 'returned_to_submitted';
    actorProfileId: string;
    note?: string | null;
  },
) {
  await supabase.from('team_leader_qc_checkpoint_logs').insert({
    checkpoint_id: payload.checkpointId,
    event_id: payload.eventId,
    team_leader_assignment_id: payload.assignmentId,
    status_snapshot: payload.statusSnapshot,
    action_kind: payload.actionKind,
    actor_profile_id: payload.actorProfileId,
    note: payload.note ?? null,
  });
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
  if (assignment.assignmentStatus !== 'accepted' && assignment.assignmentStatus !== 'confirmado') {
    return { status: 'error', message: 'Debes aceptar la asignación antes de enviar reportes de ejecución.' };
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

export async function respondToEventAssignmentAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const assignmentId = String(formData.get('assignment_id') ?? '');
  const response = String(formData.get('response') ?? 'accepted');
  const responseNote = normalizeOptionalString(formData.get('response_note'));
  if (!assignmentId || (response !== 'accepted' && response !== 'rejected')) {
    return { status: 'error', message: 'Respuesta de asignación inválida.' };
  }

  const assignment = await getEmployeeAssignmentById(assignmentId, session.user.id);
  if (!assignment) {
    return { status: 'error', message: 'No encontramos una asignación válida para tu usuario.' };
  }

  const { error } = await supabase
    .from('event_staff_assignments')
    .update({
      assignment_status: response,
      responded_by: session.user.id,
      responded_at: new Date().toISOString(),
      response_note: responseNote,
      updated_by: session.user.id,
    })
    .eq('id', assignmentId)
    .eq('profile_id', session.user.id);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar tu respuesta de asignación.' };
  }

  if (response === 'accepted') {
    const { data: handoffState } = await supabase
      .from('event_operational_handoff_state')
      .select('id, handoff_status, target_team_leader_assignment_id')
      .eq('event_id', assignment.event.id)
      .maybeSingle();

    if (handoffState?.handoff_status === 'ready_for_handoff' && handoffState.target_team_leader_assignment_id === assignmentId) {
      await supabase
        .from('event_operational_handoff_state')
        .update({
          handoff_status: 'handed_off',
        })
        .eq('id', handoffState.id);
    }
  }

  revalidatePath('/empleados' as Route);
  revalidatePath('/eventos' as Route);
  return {
    status: 'success',
    message: response === 'accepted' ? 'Asignación aceptada correctamente.' : 'Asignación rechazada. Operación revisará la reasignación.',
  };
}

export async function updateTeamLeaderExecutionStateAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };

  const eventId = String(formData.get('event_id') ?? '');
  const requirementId = String(formData.get('requirement_id') ?? '');
  const track = String(formData.get('track') ?? 'shopping') as 'shopping' | 'picking';
  const nextStatusRaw = String(formData.get('next_status') ?? 'pending');
  if (!eventId || !requirementId || (track !== 'shopping' && track !== 'picking')) {
    return { status: 'error', message: 'Solicitud inválida para actualizar ejecución.' };
  }

  const assignment = await getTeamLeaderExecutionAssignment(session.user.id, eventId);
  if (!assignment) {
    return { status: 'error', message: 'Solo Team Leader asignado y aceptado puede actualizar esta ejecución.' };
  }

  const normalizedStatus = normalizeExecutionStatus(track, nextStatusRaw);
  if (!normalizedStatus) {
    return { status: 'error', message: 'Estado de ejecución inválido.' };
  }

  const { data: requirement } = await supabase
    .from('event_inventory_requirements')
    .select('id')
    .eq('id', requirementId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!requirement) {
    return { status: 'error', message: 'No encontramos ese material en el evento.' };
  }

  const nowIso = new Date().toISOString();
  const { data: executionState } = await supabase
    .from('event_inventory_execution_state')
    .select('id')
    .eq('event_inventory_requirement_id', requirementId)
    .maybeSingle();

  if (!executionState) {
    await supabase.from('event_inventory_execution_state').insert({
      event_inventory_requirement_id: requirementId,
      shopping_status: track === 'shopping' ? normalizedStatus : 'pending',
      shopping_updated_at: track === 'shopping' ? nowIso : null,
      shopping_updated_by: track === 'shopping' ? session.user.id : null,
      picking_status: track === 'picking' ? normalizedStatus : 'pending',
      picking_updated_at: track === 'picking' ? nowIso : null,
      picking_updated_by: track === 'picking' ? session.user.id : null,
      note: `Actualizado por Team Leader (${assignment.id}).`,
    });
  } else if (track === 'shopping') {
    await supabase
      .from('event_inventory_execution_state')
      .update({
        shopping_status: normalizedStatus,
        shopping_updated_at: nowIso,
        shopping_updated_by: session.user.id,
      })
      .eq('event_inventory_requirement_id', requirementId);
  } else {
    await supabase
      .from('event_inventory_execution_state')
      .update({
        picking_status: normalizedStatus,
        picking_updated_at: nowIso,
        picking_updated_by: session.user.id,
      })
      .eq('event_inventory_requirement_id', requirementId);
  }

  revalidatePath('/empleados' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
  return { status: 'success', message: 'Ejecución actualizada.' };
}

export async function toggleTeamLeaderChecklistItemAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };

  const eventId = String(formData.get('event_id') ?? '');
  const checklistItemId = String(formData.get('checklist_item_id') ?? '');
  const nextCompleted = String(formData.get('next_completed') ?? 'false') === 'true';

  if (!eventId || !checklistItemId) {
    return { status: 'error', message: 'Checklist inválida.' };
  }

  const assignment = await getTeamLeaderExecutionAssignment(session.user.id, eventId);
  if (!assignment) {
    return { status: 'error', message: 'Solo Team Leader asignado y aceptado puede editar checklist.' };
  }

  const { data: checklistItem } = await supabase
    .from('event_checklist_items')
    .select('id')
    .eq('id', checklistItemId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!checklistItem) {
    return { status: 'error', message: 'No encontramos ese ítem de checklist.' };
  }

  await supabase
    .from('event_checklist_items')
    .update({
      is_completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : null,
      updated_by: session.user.id,
    })
    .eq('id', checklistItemId);

  revalidatePath('/empleados' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
  return { status: 'success', message: nextCompleted ? 'Checklist completada.' : 'Checklist reabierta.' };
}

export async function submitTeamLeaderCloseoutAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };

  const eventId = String(formData.get('event_id') ?? '');
  const requirementId = String(formData.get('requirement_id') ?? '');
  if (!eventId || !requirementId) return { status: 'error', message: 'Closeout inválido.' };

  const assignment = await getTeamLeaderExecutionAssignment(session.user.id, eventId);
  if (!assignment) {
    return { status: 'error', message: 'Solo Team Leader asignado y aceptado puede enviar closeout.' };
  }

  const quantityUsed = normalizeNonNegativeNumber(formData.get('quantity_used'));
  const leftoverQuantity = normalizeNonNegativeNumber(formData.get('leftover_quantity'));
  const returnedQuantity = normalizeNonNegativeNumber(formData.get('returned_quantity'));
  const wasteQuantity = normalizeNonNegativeNumber(formData.get('waste_quantity'));
  const note = normalizeOptionalString(formData.get('closeout_note'));

  if (
    quantityUsed == null ||
    leftoverQuantity == null ||
    returnedQuantity == null ||
    wasteQuantity == null ||
    returnedQuantity > leftoverQuantity ||
    wasteQuantity > leftoverQuantity ||
    returnedQuantity + wasteQuantity > leftoverQuantity
  ) {
    return { status: 'error', message: 'Revisa cantidades de closeout. Hay valores inválidos.' };
  }

  const nowIso = new Date().toISOString();

  await supabase
    .from('event_inventory_requirements')
    .update({
      quantity_used: quantityUsed,
      updated_by: session.user.id,
    })
    .eq('id', requirementId)
    .eq('event_id', eventId);

  await supabase
    .from('event_inventory_closeout_state')
    .upsert(
      {
        event_inventory_requirement_id: requirementId,
        leftover_quantity: leftoverQuantity,
        returned_quantity: returnedQuantity,
        waste_quantity: wasteQuantity,
        closeout_status: 'submitted' as EventInventoryCloseoutStatus,
        closed_by: session.user.id,
        closed_at: nowIso,
        note,
      },
      { onConflict: 'event_inventory_requirement_id' },
    );

  revalidatePath('/empleados' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
  return { status: 'success', message: 'Closeout enviado para revisión de Supervisor/Owner.' };
}

export async function completeAssistantChecklistItemAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };

  const eventId = String(formData.get('event_id') ?? '');
  const checklistItemId = String(formData.get('checklist_item_id') ?? '');
  if (!eventId || !checklistItemId) return { status: 'error', message: 'Checklist inválida.' };

  const assignment = await getAssistantExecutionAssignment(session.user.id, eventId);
  if (!assignment) {
    return { status: 'error', message: 'Solo Assistant asignado y aceptado puede marcar su checklist de apoyo.' };
  }

  const { data: checklistItem } = await supabase
    .from('event_checklist_items')
    .select('id, is_completed')
    .eq('id', checklistItemId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!checklistItem) return { status: 'error', message: 'No encontramos ese ítem de checklist.' };
  if (checklistItem.is_completed) return { status: 'success', message: 'Ese ítem ya estaba marcado como completado.' };

  await supabase
    .from('event_checklist_items')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq('id', checklistItemId);

  revalidatePath('/empleados' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
  return { status: 'success', message: 'Checklist de apoyo marcada como completada.' };
}

export async function submitTeamLeaderQcCheckpointAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };

  const eventId = String(formData.get('event_id') ?? '');
  const checkpointKeyRaw = String(formData.get('checkpoint_key') ?? '');
  const comment = normalizeOptionalString(formData.get('checkpoint_comment'));
  const evidenceFiles = formData
    .getAll('checkpoint_evidence_files')
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, 6);

  if (!eventId || !isTeamLeaderQcCheckpointKey(checkpointKeyRaw)) {
    return { status: 'error', message: 'Checkpoint inválido.' };
  }
  if (evidenceFiles.length === 0) {
    return { status: 'error', message: 'Sube al menos una evidencia para registrar el checkpoint.' };
  }

  const assignment = await getTeamLeaderExecutionAssignment(session.user.id, eventId);
  if (!assignment) {
    return { status: 'error', message: 'Solo Team Leader asignado y aceptado puede registrar checkpoints.' };
  }

  await ensureTeamLeaderQcCheckpoints(supabase, eventId, assignment.id);
  const { data: checkpointRow } = await supabase
    .from('team_leader_qc_checkpoints')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('team_leader_assignment_id', assignment.id)
    .eq('checkpoint_key', checkpointKeyRaw)
    .maybeSingle();
  if (!checkpointRow) {
    return { status: 'error', message: 'No fue posible ubicar el checkpoint para este evento.' };
  }

  const wasObserved = checkpointRow.status === 'observed';

  const reportStage = TEAM_LEADER_QC_CHECKPOINT_TO_REPORT_STAGE[checkpointKeyRaw];
  const reportNote = `QC checkpoint · ${TEAM_LEADER_QC_CHECKPOINT_LABELS[checkpointKeyRaw]}`;
  const { data: reportInsert, error: reportInsertError } = await supabase
    .from('employee_event_reports')
    .insert({
      event_id: eventId,
      assignment_id: assignment.id,
      reporter_profile_id: session.user.id,
      report_stage: reportStage,
      status_update: reportNote,
      service_notes: comment,
      evidence_urls: [],
      review_status: 'pendiente_revision',
    })
    .select('id')
    .single();

  if (reportInsertError || !reportInsert) {
    return { status: 'error', message: 'No pudimos crear el reporte base del checkpoint.' };
  }

  const uploadErrors: string[] = [];
  for (const file of evidenceFiles) {
    const safeName = normalizeFileName(file.name || `qc-${checkpointKeyRaw}-${Date.now()}.jpg`);
    const storagePath = `${session.user.id}/${reportInsert.id}/${checkpointKeyRaw}-${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from('employee-evidences').upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (upload.error) {
      uploadErrors.push(file.name || safeName);
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

  if (evidenceFiles.length > 0 && uploadErrors.length === evidenceFiles.length) {
    await supabase.from('employee_event_reports').delete().eq('id', reportInsert.id);
    return { status: 'error', message: 'No pudimos subir evidencias. Intenta nuevamente.' };
  }

  await supabase
    .from('team_leader_qc_checkpoints')
    .update({
      status: 'submitted',
      report_id: reportInsert.id,
      comment,
      recorded_at: new Date().toISOString(),
      submitted_by: session.user.id,
      submitted_at: new Date().toISOString(),
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', checkpointRow.id);

  await appendCheckpointLog(supabase, {
    checkpointId: checkpointRow.id,
    eventId,
    assignmentId: assignment.id,
    statusSnapshot: 'submitted',
    actionKind: wasObserved ? 'resubmitted' : 'submitted',
    actorProfileId: session.user.id,
    note: comment,
  });

  revalidatePath('/empleados' as Route);
  revalidatePath('/empleados/revision' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);

  if (uploadErrors.length > 0) {
    return {
      status: 'success',
      message: `Checkpoint enviado, pero faltaron algunas evidencias (${uploadErrors.join(', ')}).`,
    };
  }
  return { status: 'success', message: 'Checkpoint QC enviado con evidencia. Queda listo para revisión supervisor/gerencial.' };
}

export async function reviewTeamLeaderQcCheckpointAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const checkpointId = String(formData.get('checkpoint_id') ?? '');
  const reviewStatus = String(formData.get('review_status') ?? 'approved');
  const reviewNote = normalizeOptionalString(formData.get('review_note'));
  if (!checkpointId) return { status: 'error', message: 'No encontramos el checkpoint a revisar.' };
  if (reviewStatus !== 'approved' && reviewStatus !== 'observed' && reviewStatus !== 'submitted') {
    return { status: 'error', message: 'Estado de revisión de checkpoint inválido.' };
  }

  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (session.user.rol === 'empleado') return { status: 'error', message: 'Solo supervisor/gerencia puede revisar checkpoints.' };

  const { data: checkpoint } = await supabase
    .from('team_leader_qc_checkpoints')
    .select('id, event_id, report_id, team_leader_assignment_id')
    .eq('id', checkpointId)
    .maybeSingle();
  if (!checkpoint) return { status: 'error', message: 'Checkpoint no encontrado.' };

  const nowIso = new Date().toISOString();
  await supabase
    .from('team_leader_qc_checkpoints')
    .update({
      status: reviewStatus,
      review_notes: reviewNote,
      reviewed_by: reviewStatus === 'submitted' ? null : session.user.id,
      reviewed_at: reviewStatus === 'submitted' ? null : nowIso,
    })
    .eq('id', checkpointId);

  await appendCheckpointLog(supabase, {
    checkpointId,
    eventId: checkpoint.event_id,
    assignmentId: checkpoint.team_leader_assignment_id,
    statusSnapshot: reviewStatus === 'submitted' ? 'submitted' : reviewStatus,
    actionKind: reviewStatus === 'approved' ? 'approved' : reviewStatus === 'observed' ? 'observed' : 'returned_to_submitted',
    actorProfileId: session.user.id,
    note: reviewNote,
  });

  if (checkpoint.report_id) {
    await supabase
      .from('employee_event_reports')
      .update({
        review_status: reviewStatus === 'approved' ? 'aprobado' : reviewStatus === 'observed' ? 'observado' : 'pendiente_revision',
        review_notes: reviewNote,
        reviewed_by: reviewStatus === 'submitted' ? null : session.user.id,
        reviewed_at: reviewStatus === 'submitted' ? null : nowIso,
        correction_requested_at: reviewStatus === 'observed' ? nowIso : null,
      })
      .eq('id', checkpoint.report_id);
  }

  revalidatePath('/empleados/revision' as Route);
  revalidatePath('/empleados' as Route);
  revalidatePath(`/eventos/${checkpoint.event_id}` as Route);
  return {
    status: 'success',
    message: reviewStatus === 'approved'
      ? 'Checkpoint aprobado y trazado.'
      : reviewStatus === 'observed'
        ? 'Checkpoint observado. Team Leader verá tu nota.'
        : 'Checkpoint regresado a estado enviado.',
  };
}

export async function saveTeamLeaderBonusRecommendationAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (session.user.rol === 'empleado') return { status: 'error', message: 'Solo supervisor/gerencia puede registrar recomendación.' };

  const eventId = String(formData.get('event_id') ?? '');
  const assignmentId = String(formData.get('team_leader_assignment_id') ?? '');
  const complianceStatus = normalizeComplianceStatus(String(formData.get('compliance_status') ?? 'con_observaciones'));
  const recommendationStatus = normalizeRecommendationStatus(String(formData.get('recommendation_status') ?? 'pending'));
  const suggestedAmount = normalizeOptionalString(formData.get('suggested_bonus_amount'));
  const supervisorNote = normalizeOptionalString(formData.get('supervisor_note'));
  const suggestedBonusAmount = suggestedAmount ? Number(suggestedAmount) : null;
  if (!eventId || !assignmentId || !complianceStatus || !recommendationStatus) {
    return { status: 'error', message: 'Datos inválidos para recomendación de bonus/compliance.' };
  }
  if (suggestedBonusAmount != null && (!Number.isFinite(suggestedBonusAmount) || suggestedBonusAmount < 0)) {
    return { status: 'error', message: 'Monto sugerido inválido.' };
  }

  await supabase.from('team_leader_bonus_recommendations').upsert(
    {
      event_id: eventId,
      team_leader_assignment_id: assignmentId,
      compliance_status: complianceStatus,
      recommendation_status: recommendationStatus,
      suggested_bonus_amount: suggestedBonusAmount,
      supervisor_note: supervisorNote,
      recommended_by: session.user.id,
      recommended_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,team_leader_assignment_id' },
  );

  revalidatePath('/empleados/revision' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
  return { status: 'success', message: 'Recomendación manual de bonus/compliance guardada.' };
}

export async function finalizeTeamLeaderBonusDecisionAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (session.user.rol !== 'owner' && session.user.rol !== 'manager') {
    return { status: 'error', message: 'Solo Owner/Main Office puede confirmar o rechazar bonus.' };
  }

  const recommendationId = String(formData.get('recommendation_id') ?? '');
  const decisionStatus = normalizeFinalDecisionStatus(String(formData.get('final_decision_status') ?? 'pending'));
  const amountRaw = normalizeOptionalString(formData.get('final_bonus_amount'));
  const finalNote = normalizeOptionalString(formData.get('final_note'));
  const finalBonusAmount = amountRaw ? Number(amountRaw) : null;
  if (!recommendationId || !decisionStatus) return { status: 'error', message: 'Decisión final inválida.' };
  if (finalBonusAmount != null && (!Number.isFinite(finalBonusAmount) || finalBonusAmount < 0)) {
    return { status: 'error', message: 'Monto final inválido.' };
  }

  const { data: recommendation } = await supabase
    .from('team_leader_bonus_recommendations')
    .select('id, event_id')
    .eq('id', recommendationId)
    .maybeSingle();
  if (!recommendation) return { status: 'error', message: 'No encontramos la recomendación a confirmar.' };

  await supabase
    .from('team_leader_bonus_recommendations')
    .update({
      final_decision_status: decisionStatus,
      final_bonus_amount: decisionStatus === 'approved' ? finalBonusAmount : null,
      final_note: finalNote,
      decided_by: decisionStatus === 'pending' ? null : session.user.id,
      decided_at: decisionStatus === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', recommendationId);

  revalidatePath('/empleados/revision' as Route);
  revalidatePath(`/eventos/${recommendation.event_id}` as Route);
  return { status: 'success', message: 'Decisión final de bonus actualizada.' };
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
