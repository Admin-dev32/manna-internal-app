import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, ChevronLeft, ChevronRight, Filter, List, TriangleAlert } from 'lucide-react';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EVENT_STATUS_LABELS } from '@/config/events';
import type { ClientRecord } from '@/types/clients';
import type { EventChecklistProgress, EventRecord } from '@/types/events';
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

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getMonthBounds(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  return { firstDay, lastDay };
}

function addMonths(monthValue: string, amount: number) {
  const [year, month] = monthValue.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildViewHref({
  view,
  month,
  filters,
}: {
  view: 'list' | 'calendar';
  month?: string;
  filters: { status?: string; from?: string; to?: string };
}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'todos') params.set('status', filters.status);
  if (view === 'list') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  }
  if (view === 'calendar') {
    params.set('view', 'calendar');
    if (month) params.set('month', month);
  }
  const query = params.toString();
  return (`/eventos${query ? `?${query}` : ''}`) as Route;
}

export function EventsList({
  events,
  clients,
  quotes,
  checklistProgressByEvent,
  filters,
  view,
  month,
}: {
  events: EventRecord[];
  clients: Record<string, ClientRecord>;
  quotes: Record<string, Pick<QuoteRecord, 'id' | 'status'>>;
  checklistProgressByEvent: Record<string, EventChecklistProgress>;
  filters: { status?: string; from?: string; to?: string };
  view: 'list' | 'calendar';
  month: string;
}) {
  const pendingEvents = events.filter((event) => event.status === 'pendiente' || event.status === 'en_preparacion').length;
  const upcomingEvents = events.filter((event) => isUpcoming(event.event_date) && event.status !== 'completado' && event.status !== 'cancelado').length;
  const monthBounds = getMonthBounds(month);
  const monthStartWeekday = (monthBounds.firstDay.getUTCDay() + 6) % 7;
  const totalDays = monthBounds.lastDay.getUTCDate();
  const calendarCells = Array.from({ length: monthStartWeekday + totalDays }, (_, index) => {
    const dayNumber = index - monthStartWeekday + 1;
    if (dayNumber < 1 || dayNumber > totalDays) return null;
    return String(dayNumber).padStart(2, '0');
  });
  const eventsByDay = events.reduce(
    (accumulator, event) => {
      const day = event.event_date.slice(8, 10);
      const existing = accumulator[day] ?? [];
      existing.push(event);
      accumulator[day] = existing;
      return accumulator;
    },
    {} as Record<string, EventRecord[]>,
  );
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  return (
    <ModulePageLayout
      badge="Operación"
      title="Eventos"
      description="Coordinación de eventos confirmados con acceso rápido a checklist, tareas y señales operativas."
      breadcrumbs={[{ label: 'Operación' }, { label: 'Eventos' }]}
    >

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Eventos visibles" value={String(events.length)} hint="Según filtros aplicados" />
        <SummaryCard title="Próximos 7 días" value={String(upcomingEvents)} hint="Pendientes de seguimiento cercano" />
        <SummaryCard title="Pendientes / preparación" value={String(pendingEvents)} hint="Eventos que aún requieren trabajo operativo" />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Vista</CardTitle>
            <CardDescription>Alterna entre agenda en lista y calendario mensual.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant={view === 'list' ? 'default' : 'outline'}>
              <Link href={buildViewHref({ view: 'list', filters })}>
                <List className="size-4" />
                Lista
              </Link>
            </Button>
            <Button asChild variant={view === 'calendar' ? 'default' : 'outline'}>
              <Link href={buildViewHref({ view: 'calendar', month, filters })}>
                <CalendarClock className="size-4" />
                Calendario
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

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

      {view === 'list' ? (
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
      ) : (
        <Card>
          <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Calendario de eventos</CardTitle>
              <CardDescription>Vista mensual para operación con acceso rápido al detalle.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild size="sm" variant="outline">
                <Link href={buildViewHref({ view: 'calendar', month: previousMonth, filters })}>
                  <ChevronLeft className="size-4" />
                  Mes anterior
                </Link>
              </Button>
              <Badge variant="secondary" className="capitalize">{formatMonthLabel(month)}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={buildViewHref({ view: 'calendar', month: nextMonth, filters })}>
                  Mes siguiente
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                <div key={day} className="rounded-xl border border-border bg-muted/30 py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {calendarCells.map((dayKey, index) => {
                if (!dayKey) {
                  return <div key={`empty-${index}`} className="min-h-36 rounded-2xl border border-dashed border-border/70 bg-muted/10" />;
                }

                const dayEvents = eventsByDay[dayKey] ?? [];
                return (
                  <div key={dayKey} className="min-h-36 rounded-2xl border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{Number(dayKey)}</p>
                      <Badge variant={dayEvents.length > 0 ? 'warning' : 'outline'}>{dayEvents.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {dayEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin eventos</p>
                      ) : (
                        dayEvents.map((event) => (
                          <Link
                            key={event.id}
                            href={`/eventos/${event.id}` as Route}
                            className="block rounded-xl border border-border/70 bg-muted/20 p-2 transition hover:border-primary hover:bg-primary/5"
                          >
                            <p className="text-xs font-semibold text-foreground">{event.event_type ?? `Evento #${event.id.slice(0, 6)}`}</p>
                            <p className="text-[11px] text-muted-foreground">{event.event_time} · {clients[event.client_id]?.full_name ?? 'Cliente interno'}</p>
                            <p className="text-[11px] text-muted-foreground">Servicio: {event.booked_service}</p>
                            <div className="mt-1">
                              <EventStatusBadge status={event.status} />
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </ModulePageLayout>
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
