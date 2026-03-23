export const REMINDER_AREAS = ['lead', 'task', 'pre_event', 'event'] as const;
export const REMINDER_TIMINGS = ['overdue', 'today', 'upcoming', 'incomplete'] as const;
export const REMINDER_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export type ReminderArea = (typeof REMINDER_AREAS)[number];
export type ReminderTiming = (typeof REMINDER_TIMINGS)[number];
export type ReminderSeverity = (typeof REMINDER_SEVERITIES)[number];

export interface ReminderItem {
  id: string;
  area: ReminderArea;
  timing: ReminderTiming;
  severity: ReminderSeverity;
  title: string;
  description: string;
  entityLabel: string;
  href: string;
  dueAt: string | null;
  responsibleLabel: string | null;
  tags: string[];
}

export interface ReminderSummary {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  incomplete: number;
  critical: number;
  byArea: Record<ReminderArea, number>;
}

export interface ReminderCenterData {
  generatedAt: string;
  summary: ReminderSummary;
  items: ReminderItem[];
  topItems: ReminderItem[];
}
