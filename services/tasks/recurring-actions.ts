'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeInitialNextRunAt, runDueRecurringTaskRules } from '@/services/tasks/recurring';
import type { EventTaskPriority, EventTaskStatus } from '@/types/events';
import type { RecurringTaskCadenceType } from '@/types/recurring-tasks';

function normalizeText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCadence(value: FormDataEntryValue | null): RecurringTaskCadenceType {
  const normalized = String(value ?? 'weekly').trim();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly') {
    return normalized;
  }

  return 'weekly';
}

function normalizePriority(value: FormDataEntryValue | null): EventTaskPriority {
  const normalized = String(value ?? 'media').trim();
  if (normalized === 'baja' || normalized === 'media' || normalized === 'alta' || normalized === 'urgente') {
    return normalized;
  }

  return 'media';
}

function normalizeStatus(value: FormDataEntryValue | null): EventTaskStatus {
  const normalized = String(value ?? 'pendiente').trim();
  if (normalized === 'pendiente' || normalized === 'en_progreso' || normalized === 'completada' || normalized === 'bloqueada') {
    return normalized;
  }

  return 'pendiente';
}

function normalizeInterval(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '1').trim());
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

function normalizeDayOfWeek(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  if (normalized == null) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.floor(parsed);
  if (rounded < 0 || rounded > 6) return null;
  return rounded;
}

function normalizeDayOfMonth(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  if (normalized == null) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.floor(parsed);
  if (rounded < 1 || rounded > 31) return null;
  return rounded;
}

function normalizeDueTime(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return /^(\d{2}):(\d{2})$/.test(normalized) ? `${normalized}:00` : '09:00:00';
}

export async function createRecurringTaskRuleAction(eventId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  if (!hasPermission(session.user, 'tasks.manage')) return;

  const title = normalizeText(formData.get('title'));
  if (!title) return;

  const cadenceType = normalizeCadence(formData.get('cadence_type'));
  const intervalCount = normalizeInterval(formData.get('interval_count'));
  const dayOfWeek = cadenceType === 'weekly' ? normalizeDayOfWeek(formData.get('day_of_week')) : null;
  const dayOfMonth = cadenceType === 'monthly' ? normalizeDayOfMonth(formData.get('day_of_month')) : null;
  const startDate = normalizeText(formData.get('start_date'));
  if (!startDate) return;

  const dueTime = normalizeDueTime(formData.get('due_time'));
  const initialNextRunAt = computeInitialNextRunAt({ cadenceType, intervalCount, dayOfWeek, dayOfMonth, startDate, dueTime });

  await supabase.from('recurring_task_rules').insert({
    event_id: eventId,
    title,
    description: normalizeText(formData.get('description')),
    internal_note: normalizeText(formData.get('internal_note')),
    assigned_profile_id: normalizeText(formData.get('assigned_profile_id')),
    priority: normalizePriority(formData.get('priority')),
    status_template: normalizeStatus(formData.get('status_template')),
    cadence_type: cadenceType,
    interval_count: intervalCount,
    day_of_week: dayOfWeek,
    day_of_month: dayOfMonth,
    start_date: startDate,
    due_time: dueTime,
    next_run_at: initialNextRunAt.toISOString(),
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  revalidatePath(`/eventos/${eventId}` as Route);
  revalidatePath('/tareas' as Route);
  revalidatePath('/notificaciones' as Route);
}

export async function toggleRecurringTaskRuleActiveAction(eventId: string, ruleId: string, nextIsActive: boolean) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  if (!hasPermission(session.user, 'tasks.manage')) return;

  await supabase
    .from('recurring_task_rules')
    .update({
      is_active: nextIsActive,
      updated_by: session.user.id,
    })
    .eq('id', ruleId)
    .eq('event_id', eventId);

  revalidatePath(`/eventos/${eventId}` as Route);
}

export async function runDueRecurringTasksForEventAction(eventId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  if (!hasPermission(session.user, 'tasks.manage')) return;

  await runDueRecurringTaskRules({
    supabase,
    actorUserId: session.user.id,
    eventId,
    limit: 60,
  });

  revalidatePath(`/eventos/${eventId}` as Route);
  revalidatePath('/tareas' as Route);
  revalidatePath('/notificaciones' as Route);
}
