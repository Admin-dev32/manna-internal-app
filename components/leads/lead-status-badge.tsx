import { Badge } from '@/components/ui/badge';
import { leadPriorityLabels, leadStatusLabels } from '@/config/leads';
import type { LeadPriority, LeadStatus } from '@/types/leads';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const variant = status === 'ganado' ? 'success' : status === 'perdido' ? 'warning' : 'secondary';
  return <Badge variant={variant}>{leadStatusLabels[status]}</Badge>;
}

export function LeadPriorityBadge({ priority }: { priority: LeadPriority }) {
  const variant = priority === 'urgente' || priority === 'alta' ? 'warning' : 'outline';
  return <Badge variant={variant}>{leadPriorityLabels[priority]}</Badge>;
}
