import { Badge } from '@/components/ui/badge';
import { quoteStatusLabels } from '@/config/quotes';
import { cn } from '@/lib/utils';
import type { QuoteStatus } from '@/types/quotes';

const statusClasses: Record<QuoteStatus, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviada: 'bg-sky-100 text-sky-700',
  aceptada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-rose-100 text-rose-700',
  vencida: 'bg-amber-100 text-amber-700',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="secondary" className={cn(statusClasses[status])}>
      {quoteStatusLabels[status]}
    </Badge>
  );
}
