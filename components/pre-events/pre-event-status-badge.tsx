import { Badge } from '@/components/ui/badge';
import { preEventStatusLabels } from '@/config/pre-events';
import { cn } from '@/lib/utils';
import type { PreEventStatus } from '@/types/pre-events';

const toneMap: Record<PreEventStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  confirmado: 'bg-emerald-100 text-emerald-700',
  en_preparacion: 'bg-amber-100 text-amber-700',
};

export function PreEventStatusBadge({ status }: { status: PreEventStatus }) {
  return (
    <Badge variant="secondary" className={cn(toneMap[status])}>
      {preEventStatusLabels[status]}
    </Badge>
  );
}
