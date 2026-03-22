import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, Filter, TriangleAlert } from 'lucide-react';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_STATUS_LABELS } from '@/config/events';
import type { ClientRecord } from '@/types/clients';
import type { EventChecklistProgress, EventRecord, EventStatus } from '@/types/events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function isUpcoming(value: string) {
  const today = new Date();
  const eventDate = new Date(`${value}T00:00:00`);
  const diffInDays = Math.ceil((eventDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);

  return diffInDays >= 0 && diffInDays <= 7;
}

export function EventsList({
  events,
  clients,
  quotes,
  checklistProgressByEvent,
  filters,
}: {
  events: EventRecord[];
  clients: Record<string, ClientRecord>;
  quotes: Record<string, Pick<QuoteRecord, 'id' | 'status'>>;
  checklistProgressByEvent: Record<string, EventChecklistProgress>;
  filters: { status?: string; from?: string; to?: string };
}) {
  const pendingEvents = events.filter((event) => event.status === 'pendiente' || event.status === 'en_preparacion').length;
  const upcomingEvents = events.filter((event) => isUpcoming(event.event_date) && event.status !== 'completado' && event.status !== 'cancelado').length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Operación</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Event Operations Core</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Eventos operativos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Vista operativa para coordinar eventos reales, revisar checklist, detectar próximos compromisos y entrar rápido al detalle.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Eventos visibles" value={String(events.length)} hint="Según filtros aplicados" />
        <SummaryCard title="Próximos 7 días" value={String(upcomingEvents)} hint="Pendientes de seguimiento cercano" />
        <SummaryCard title="Pendientes / preparación" value={String(pendingEvents)} hint="Eventos que aún requieren trabajo operativo" />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Filtros operativos</CardTitle>
            <CardDescription>Refina por estado y rango de fechas para trabajo diario de operación.</CardDescription>
          </div>
          <form className="grid w-full gap-3 md:grid-cols-4" method="get">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="status">
                Estado
              </label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? 'todos'}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="todos">Todos</option>
                {Object.entries(EVENT_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="from">
                Desde
              </label>
              <input
                id="from"
                type="date"
                name="from"
                defaultValue={filters.from ?? ''}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="to">
                Hasta
              </label>
              <input
                id="to"
                type="date"
                name="to"
                defaultValue={filters.to ?? ''}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="flex items-end gap-3">
              <Button type="submit" variant="outline" className="flex-1">
                <Filter className="size-4" />
                Filtrar
              </Button>
              <Button asChild variant="ghost" className="flex-1">
                <Link href={'/eventos' as Route}>Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda operativa</CardTitle>
          <CardDescription>Escaneo rápido de eventos, estado actual y avance de checklist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No hay eventos para los filtros elegidos. Ajusta estado o fechas para revisar la operación.
            </div>
          ) : (
            events.map((event) => {
              const progress = checklistProgressByEvent[event.id] ?? { total: 0, completed: 0, pending: 0 };
              const client = clients[event.client_id];
              const isSoon = isUpcoming(event.event_date);
              const needsAttention = event.status === 'pendiente' || progress.pending > 0;

              return (
                <div key={event.id} className="rounded-3xl border border-border bg-background p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <EventStatusBadge status={event.status} />
                        {isSoon ? <Badge variant="warning">Próximo</Badge> : null}
                        {needsAttention ? <Badge variant="outline">Requiere atención</Badge> : null}
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold text-foreground">{event.event_type ?? 'Evento operativo'}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Cliente: {client?.full_name ?? 'Cliente interno'}</p>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                        <InfoPill icon={CalendarClock} text={`${formatDate(event.event_date)} · ${event.event_time}`} />
                        <InfoPill icon={TriangleAlert} text={event.location ?? 'Dirección pendiente'} />
                        <InfoPill icon={Filter} text={`Servicio: ${event.booked_service}`} />
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="secondary">Checklist {progress.completed}/{progress.total || 0}</Badge>
                        <Badge variant={progress.pending > 0 ? 'warning' : 'success'}>
                          {progress.pending > 0 ? `${progress.pending} ítems pendientes` : 'Checklist al día'}
                        </Badge>
                        <Badge variant="outline">Reserva #{event.source_pre_event_id.slice(0, 8)}</Badge>
                        <Badge variant="outline">Cotización #{quotes[event.source_quote_id]?.id.slice(0, 8) ?? event.source_quote_id.slice(0, 8)}</Badge>
                      </div>
                    </div>

                    <Button asChild>
                      <Link href={`/eventos/${event.id}` as Route}>Abrir detalle</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{title}</p>
        <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function InfoPill({ icon: Icon, text }: { icon: typeof CalendarClock; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2">
      <Icon className="size-4 text-primary" />
      <span>{text}</span>
    </div>
  );
}
