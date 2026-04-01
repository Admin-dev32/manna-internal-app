import type { EventTaskPriority, EventTaskStatus } from '@/types/events';

export const RECURRING_TASK_CADENCE_TYPES = ['daily', 'weekly', 'monthly'] as const;
export const RECURRING_TASK_RUN_STATUSES = ['success', 'skipped', 'error'] as const;

export type RecurringTaskCadenceType = (typeof RECURRING_TASK_CADENCE_TYPES)[number];
export type RecurringTaskRunStatus = (typeof RECURRING_TASK_RUN_STATUSES)[number];

export interface RecurringTaskRuleRecord {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  internal_note: string | null;
  assigned_profile_id: string | null;
  priority: EventTaskPriority;
  status_template: EventTaskStatus;
  cadence_type: RecurringTaskCadenceType;
  interval_count: number;
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  due_time: string;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskRunRecord {
  id: string;
  rule_id: string;
  scheduled_for: string;
  generated_task_id: string | null;
  run_status: RecurringTaskRunStatus;
  error_message: string | null;
  created_at: string;
}

export interface RecurringTaskExecutionSummary {
  evaluated: number;
  created: number;
  skipped: number;
  errors: number;
}
