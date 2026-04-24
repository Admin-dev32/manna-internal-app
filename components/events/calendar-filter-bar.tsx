import type { Route } from 'next';
import Link from 'next/link';
import { Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_STATUS_LABELS } from '@/config/events';
import type { PaymentStatus } from '@/lib/finance/payment-status';

const PAYMENT_STATUS_OPTIONS: Array<{ value: 'todos' | PaymentStatus; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'paid_in_full', label: 'Paid in Full' },
  { value: 'deposit_paid_balance_pending', label: 'Deposit Paid / Balance Pending' },
  { value: 'reserved_not_paid_in_full', label: 'Reserved / Not Paid in Full' },
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'cancelled_or_inactive', label: 'Cancelled / Inactive' },
  { value: 'unknown', label: 'Unknown' },
];

export function CalendarFilterBar({
  filters,
}: {
  filters: { status?: string; paymentStatus?: string; from?: string; to?: string };
}) {
  return (
    <Card>
      <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle>Filtros operativos</CardTitle>
          <CardDescription>Refina por estado operativo/financiero y rango de fechas.</CardDescription>
        </div>
        <form className="grid w-full gap-3 md:grid-cols-5" method="get">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="status">Estado</label>
            <select id="status" name="status" defaultValue={filters.status ?? 'todos'} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
              <option value="todos">Todos</option>
              {Object.entries(EVENT_STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="payment_status">Pago</label>
            <select id="payment_status" name="payment_status" defaultValue={filters.paymentStatus ?? 'todos'} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
              {PAYMENT_STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="from">Desde</label>
            <input id="from" type="date" name="from" defaultValue={filters.from ?? ''} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="to">Hasta</label>
            <input id="to" type="date" name="to" defaultValue={filters.to ?? ''} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm" />
          </div>
          <div className="flex items-end gap-3">
            <Button type="submit" variant="outline" className="flex-1"><Filter className="size-4" />Filtrar</Button>
            <Button asChild variant="ghost" className="flex-1"><Link href={'/eventos' as Route}>Limpiar</Link></Button>
          </div>
        </form>
      </CardHeader>
    </Card>
  );
}
