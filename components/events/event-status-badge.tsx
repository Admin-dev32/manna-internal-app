import { Badge } from '@/components/ui/badge';
import { EVENT_STATUS_LABELS } from '@/config/events';
import type { EventStatus } from '@/types/events';

const statusMap: Record<EventStatus, { variant: 'default' | 'secondary' | 'warning' | 'success' }> = {
  pendiente: { variant: 'warning' },
  confirmado: { variant: 'default' },
  en_preparacion: { variant: 'secondary' },
  completado: { variant: 'success' },
  cancelado: { variant: 'outline' },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const descriptor = statusMap[status];
  return <Badge variant={descriptor.variant}>{EVENT_STATUS_LABELS[status]}</Badge>;
}
