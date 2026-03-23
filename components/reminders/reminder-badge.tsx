import { REMINDER_AREA_LABELS, REMINDER_SEVERITY_LABELS, REMINDER_TIMING_LABELS } from '@/config/reminders';
import { Badge } from '@/components/ui/badge';
import type { ReminderArea, ReminderSeverity, ReminderTiming } from '@/types/reminders';

export function ReminderTimingBadge({ timing }: { timing: ReminderTiming }) {
  return (
    <Badge variant={timing === 'overdue' || timing === 'today' ? 'warning' : timing === 'upcoming' ? 'secondary' : 'outline'}>
      {REMINDER_TIMING_LABELS[timing]}
    </Badge>
  );
}

export function ReminderAreaBadge({ area }: { area: ReminderArea }) {
  return <Badge variant="outline">{REMINDER_AREA_LABELS[area]}</Badge>;
}

export function ReminderSeverityBadge({ severity }: { severity: ReminderSeverity }) {
  return <Badge variant={severity === 'critical' || severity === 'high' ? 'warning' : severity === 'medium' ? 'secondary' : 'outline'}>{REMINDER_SEVERITY_LABELS[severity]}</Badge>;
}
