import { Badge } from '@/components/ui/badge';
import type { EventStatus } from '@/types/events';

const statusMap: Record<EventStatus, { label: string; variant: 'default' | 'secondary' | 'warning' | 'success' }> = {
  programado: { label: 'Programado', variant: 'default' },
  en_operacion: { label: 'En operación', variant: 'warning' },
  completado: { label: 'Completado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const descriptor = statusMap[status];
  return <Badge variant={descriptor.variant}>{descriptor.label}</Badge>;
}
