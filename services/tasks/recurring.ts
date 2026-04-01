import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { RecurringTaskCadenceType, RecurringTaskExecutionSummary, RecurringTaskRuleRecord } from '@/types/recurring-tasks';

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function parseDueTime(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { hours: 9, minutes: 0, seconds: 0 };

  return {
    hours: Math.min(Math.max(Number(match[1]), 0), 23),
    minutes: Math.min(Math.max(Number(match[2]), 0), 59),
    seconds: Math.min(Math.max(Number(match[3] ?? 0), 0), 59),
  };
}

function buildScheduledDate(baseDate: Date, dueTime: string) {
  const { hours, minutes, seconds } = parseDueTime(dueTime);
  return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hours, minutes, seconds, 0));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonthsUtc(date: Date, months: number) {
  const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0));
  return candidate;
}

function clampDayOfMonth(year: number, monthZeroIndexed: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), lastDay);
}

export function computeNextRunAt(rule: Pick<RecurringTaskRuleRecord, 'cadence_type' | 'interval_count' | 'day_of_week' | 'day_of_month' | 'due_time'>, scheduledFor: Date) {
  const base = startOfUtcDay(scheduledFor);

  if (rule.cadence_type === 'daily') {
    return buildScheduledDate(addDays(base, rule.interval_count), rule.due_time);
  }

  if (rule.cadence_type === 'weekly') {
    const targetDow = rule.day_of_week ?? base.getUTCDay();
    const nextBlockStart = addDays(base, rule.interval_count * 7);
    const diff = (targetDow - nextBlockStart.getUTCDay() + 7) % 7;
    return buildScheduledDate(addDays(nextBlockStart, diff), rule.due_time);
  }

  const targetDay = rule.day_of_month ?? base.getUTCDate();
  const nextMonth = addMonthsUtc(base, rule.interval_count);
  const clamped = clampDayOfMonth(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), targetDay);
  return buildScheduledDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), clamped, 0, 0, 0, 0)), rule.due_time);
}

export function computeInitialNextRunAt({
  cadenceType,
  intervalCount,
  dayOfWeek,
  dayOfMonth,
  startDate,
  dueTime,
}: {
  cadenceType: RecurringTaskCadenceType;
  intervalCount: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  startDate: string;
  dueTime: string;
}) {
  const normalizedStart = startOfUtcDay(new Date(`${startDate}T00:00:00.000Z`));

  if (cadenceType === 'daily') {
    return buildScheduledDate(normalizedStart, dueTime);
  }

  if (cadenceType === 'weekly') {
    const targetDow = dayOfWeek ?? normalizedStart.getUTCDay();
    const diff = (targetDow - normalizedStart.getUTCDay() + 7) % 7;
    return buildScheduledDate(addDays(normalizedStart, diff), dueTime);
  }

  const targetDay = dayOfMonth ?? normalizedStart.getUTCDate();
  const clamped = clampDayOfMonth(normalizedStart.getUTCFullYear(), normalizedStart.getUTCMonth(), targetDay);
  const monthCandidate = new Date(Date.UTC(normalizedStart.getUTCFullYear(), normalizedStart.getUTCMonth(), clamped, 0, 0, 0, 0));

  if (monthCandidate.getTime() < normalizedStart.getTime()) {
    const nextMonth = addMonthsUtc(normalizedStart, intervalCount);
    const nextDay = clampDayOfMonth(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), targetDay);
    return buildScheduledDate(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), nextDay, 0, 0, 0, 0)), dueTime);
  }

  return buildScheduledDate(monthCandidate, dueTime);
}

export async function getRecurringTaskRulesByEventId(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as RecurringTaskRuleRecord[];

  const { data } = await supabase
    .from('recurring_task_rules')
    .select('*')
    .eq('event_id', eventId)
    .order('is_active', { ascending: false })
    .order('next_run_at', { ascending: true });

  return (data ?? []) as RecurringTaskRuleRecord[];
}

export async function runDueRecurringTaskRules({
  supabase,
  actorUserId,
  now = new Date(),
  eventId,
  limit = 30,
}: {
  supabase: SupabaseClient;
  actorUserId?: string;
  now?: Date;
  eventId?: string;
  limit?: number;
}): Promise<RecurringTaskExecutionSummary> {
  let query = supabase
    .from('recurring_task_rules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(limit);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data: dueRules } = await query;
  const rules = (dueRules ?? []) as RecurringTaskRuleRecord[];

  const summary: RecurringTaskExecutionSummary = {
    evaluated: rules.length,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const rule of rules) {
    const scheduledForIso = rule.next_run_at;
    const scheduledFor = new Date(scheduledForIso);
    const nextRunAt = computeNextRunAt(rule, scheduledFor);

    const { data: existingRun } = await supabase
      .from('recurring_task_runs')
      .select('id, run_status')
      .eq('rule_id', rule.id)
      .eq('scheduled_for', scheduledForIso)
      .maybeSingle();

    if (existingRun) {
      summary.skipped += 1;
      continue;
    }

    try {
      let assignedProfileId = rule.assigned_profile_id;
      if (!assignedProfileId) {
        const { data: fallbackAssignment } = await supabase
          .from('event_staff_assignments')
          .select('profile_id')
          .eq('event_id', rule.event_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        assignedProfileId = fallbackAssignment?.profile_id ?? null;
      }

      if (!assignedProfileId) {
        await supabase.from('recurring_task_runs').insert({
          rule_id: rule.id,
          scheduled_for: scheduledForIso,
          generated_task_id: null,
          run_status: 'error',
          error_message: 'No hay responsable disponible para materializar la tarea recurrente.',
        });

        summary.errors += 1;
        continue;
      }

      const { data: createdTask, error: taskError } = await supabase
        .from('event_tasks')
        .insert({
          event_id: rule.event_id,
          source_type: 'event',
          source_event_id: rule.event_id,
          assigned_profile_id: assignedProfileId,
          title: rule.title,
          description: rule.description,
          priority: rule.priority,
          status: rule.status_template,
          due_at: scheduledForIso,
          internal_note: rule.internal_note,
          recurring_rule_id: rule.id,
          recurring_scheduled_for: scheduledForIso,
          created_by: actorUserId ?? rule.updated_by,
          updated_by: actorUserId ?? rule.updated_by,
        })
        .select('id')
        .single();

      if (taskError || !createdTask) {
        await supabase.from('recurring_task_runs').insert({
          rule_id: rule.id,
          scheduled_for: scheduledForIso,
          generated_task_id: null,
          run_status: 'error',
          error_message: taskError?.message ?? 'No fue posible crear la tarea recurrente.',
        });

        summary.errors += 1;
        continue;
      }

      await supabase.from('recurring_task_runs').insert({
        rule_id: rule.id,
        scheduled_for: scheduledForIso,
        generated_task_id: createdTask.id,
        run_status: 'success',
      });

      await supabase
        .from('recurring_task_rules')
        .update({
          last_run_at: scheduledForIso,
          next_run_at: nextRunAt.toISOString(),
          updated_by: actorUserId ?? rule.updated_by,
        })
        .eq('id', rule.id);

      summary.created += 1;
    } catch (error) {
      await supabase.from('recurring_task_runs').insert({
        rule_id: rule.id,
        scheduled_for: scheduledForIso,
        generated_task_id: null,
        run_status: 'error',
        error_message: error instanceof Error ? error.message : 'Error desconocido al materializar recurrencia.',
      });

      summary.errors += 1;
    }
  }

  return summary;
}
