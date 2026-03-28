'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock3, MapPin, Search, Users } from 'lucide-react';

import { PreEventStatusBadge } from '@/components/pre-events/pre-event-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge';
import { preEventStatusOptions } from '@/config/pre-events';
import { initialPreEventFormState } from '@/services/pre-events/form-state';
import { quickUpdatePreEventAction } from '@/services/pre-events/actions';
import type { PreEventFormState } from '@/services/pre-events/form-state';
import { cn } from '@/lib/utils';
import type { ClientRecord } from '@/types/clients';
import type { PreEventRecord, PreEventStatus } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

interface PreEventsOperationsBoardProps {
  preEvents: PreEventRecord[];
  clients: Record<string, ClientRecord>;
  quotes: Record<string, Pick<QuoteRecord, 'id' | 'status'>>;
}

type DateFilter = 'todas' | 'sin_fecha' | 'proximas_7_dias' | 'este_mes';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'Pendiente';
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(value);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isUpcoming(value: string | null) {
  const days = daysUntil(value);
  return days !== null && days >= 0 && days <= 7;
}

function isThisMonth(value: string | null) {
  if (!value) return false;
  const target = new Date(value);
  const today = new Date();
  return target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
}

function getMissingFields(preEvent: PreEventRecord) {
  const missing: string[] = [];

  if (!preEvent.confirmed_date) missing.push('fecha');
  if (!preEvent.confirmed_time) missing.push('hora');
  if (!preEvent.location) missing.push('location');
  if (!preEvent.confirmed_guests) missing.push('invitados');

  return missing;
}

export function PreEventsOperationsBoard({ preEvents, clients, quotes }: PreEventsOperationsBoardProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PreEventStatus>('todos');
  const [dateFilter, setDateFilter] = useState<DateFilter>('todas');

  const filteredPreEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return preEvents.filter((preEvent) => {
      const client = clients[preEvent.client_id];
      const matchesSearch =
        normalizedSearch.length === 0
        || client?.full_name.toLowerCase().includes(normalizedSearch)
        || preEvent.location?.toLowerCase().includes(normalizedSearch)
        || preEvent.booked_service?.toLowerCase().includes(normalizedSearch)
        || preEvent.event_type?.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'todos' || preEvent.status === statusFilter;

      const matchesDate =
        dateFilter === 'todas'
        || (dateFilter === 'sin_fecha' && !preEvent.confirmed_date)
        || (dateFilter === 'proximas_7_dias' && isUpcoming(preEvent.confirmed_date))
        || (dateFilter === 'este_mes' && isThisMonth(preEvent.confirmed_date));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [clients, dateFilter, preEvents, search, statusFilter]);

  const summary = useMemo(
    () => ({
      pendientes: preEvents.filter((item) => item.status === 'pendiente').length,
      sinFecha: preEvents.filter((item) => !item.confirmed_date).length,
      proximas: preEvents.filter((item) => isUpcoming(item.confirmed_date)).length,
      enPreparacion: preEvents.filter((item) => item.status === 'en_preparacion').length,
    }),
    [preEvents],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pendientes" value={summary.pendientes.toString()} hint="Reservas que aún requieren aterrizar datos clave." tone="warning" />
        <SummaryCard label="Sin fecha" value={summary.sinFecha.toString()} hint="Reservas sin fecha confirmada todavía." tone="danger" />
        <SummaryCard label="Próximas 7 días" value={summary.proximas.toString()} hint="Operación que ya debería tener foco inmediato." tone="info" />
        <SummaryCard label="En preparación" value={summary.enPreparacion.toString()} hint="Reservas ya activas para coordinación operativa." tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro operativo</CardTitle>
          <CardDescription>Busca por cliente, servicio, tipo de evento o location y filtra por estado / fecha.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <label className="space-y-2 text-sm font-medium">
            <span>Búsqueda</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, servicio, tipo o location" className="pl-10" />
            </div>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'todos' | PreEventStatus)}
              className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos</option>
              {preEventStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Fecha</span>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DateFilter)}
              className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todas">Todas</option>
              <option value="sin_fecha">Sin fecha confirmada</option>
              <option value="proximas_7_dias">Próximas 7 días</option>
              <option value="este_mes">Este mes</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tablero operativo de reservas</CardTitle>
          <CardDescription>
            {filteredPreEvents.length} resultado(s). Actualiza rápido estado y datos básicos sin salir del tablero.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredPreEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No encontramos reservas con los filtros actuales.
            </div>
          ) : (
            filteredPreEvents.map((preEvent) => {
              const client = clients[preEvent.client_id];
              const quote = quotes[preEvent.source_quote_id];
              const missingFields = getMissingFields(preEvent);
              const upcoming = isUpcoming(preEvent.confirmed_date);

              return (
                <div key={preEvent.id} className="rounded-[1.75rem] border border-border bg-background p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <PreEventStatusBadge status={preEvent.status} />
                        {quote ? <QuoteStatusBadge status={quote.status} /> : null}
                        {upcoming ? <SignalPill label="Próxima" tone="info" /> : null}
                        {!preEvent.confirmed_date ? <SignalPill label="Sin fecha" tone="danger" /> : null}
                        {missingFields.length > 0 ? <SignalPill label={`Pendiente: ${missingFields.join(', ')}`} tone="warning" /> : null}
                        {preEvent.status === 'en_preparacion' ? <SignalPill label="En preparación" tone="success" /> : null}
                      </div>

                      <div>
                        <p className="text-lg font-semibold text-foreground">{client?.full_name ?? 'Cliente ligado'}</p>
                        <p className="text-sm text-muted-foreground">
                          Cotización origen: {quote ? `#${quote.id.slice(0, 8)}` : 'No disponible'} · Fecha: {formatDate(preEvent.confirmed_date)} · Hora: {preEvent.confirmed_time ?? 'Pendiente'}
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <DataPill icon={MapPin} label="Location" value={preEvent.location ?? 'Pendiente'} />
                        <DataPill icon={Users} label="Invitados" value={preEvent.confirmed_guests?.toString() ?? 'Pendiente'} />
                        <DataPill icon={Clock3} label="Servicio" value={preEvent.booked_service ?? 'Pendiente'} />
                        <DataPill icon={CalendarClock} label="Tipo" value={preEvent.event_type ?? 'Pendiente'} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:w-[220px]">
                      <Button asChild size="sm">
                        <Link href={`/reservas/${preEvent.id}` as Route}>Ver detalle</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reservas/${preEvent.id}/editar` as Route}>Editar completo</Link>
                      </Button>
                      {client ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/clientes/${client.id}` as Route}>Abrir cliente</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <QuickStatusActions
                      preEventId={preEvent.id}
                      leadId={preEvent.lead_id}
                      clientId={preEvent.client_id}
                      quoteId={preEvent.source_quote_id}
                      currentStatus={preEvent.status}
                    />
                    <QuickEditForm preEvent={preEvent} />
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

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'warning' | 'danger' | 'info' | 'success' }) {
  const toneMap = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;

  return (
    <div className={cn('rounded-[1.75rem] border p-4 shadow-sm', toneMap[tone])}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm opacity-85">{hint}</p>
    </div>
  );
}

function SignalPill({ label, tone }: { label: string; tone: 'warning' | 'danger' | 'info' | 'success' }) {
  const toneMap = {
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  } as const;

  return <span className={cn('rounded-full border px-3 py-1 text-xs font-medium', toneMap[tone])}>{label}</span>;
}

function DataPill({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function QuickStatusActions({
  preEventId,
  leadId,
  clientId,
  quoteId,
  currentStatus,
}: {
  preEventId: string;
  leadId: string | null;
  clientId: string;
  quoteId: string;
  currentStatus: PreEventStatus;
}) {
  const [state, formAction] = useActionState(quickUpdatePreEventAction.bind(null, preEventId, leadId, clientId, quoteId), initialPreEventFormState);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base">Acciones rápidas de estado</CardTitle>
        <CardDescription>Cambia el estado operativo sin entrar a la edición completa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="flex flex-wrap gap-2">
          {preEventStatusOptions.map((option) => (
            <Button key={option.value} type="submit" name="status" value={option.value} size="sm" variant={currentStatus === option.value ? 'default' : 'outline'}>
              {option.label}
            </Button>
          ))}
        </form>
        {state.message ? (
          <p className={cn('text-sm', state.status === 'error' ? 'text-red-600' : 'text-emerald-700')}>{state.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuickEditForm({ preEvent }: { preEvent: PreEventRecord }) {
  const [state, formAction] = useActionState(
    quickUpdatePreEventAction.bind(null, preEvent.id, preEvent.lead_id, preEvent.client_id, preEvent.source_quote_id),
    initialPreEventFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edición rápida operativa</CardTitle>
        <CardDescription>Ajusta fecha, hora, estado, location e invitados confirmados desde la lista.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            <span>Estado</span>
            <select
              name="status"
              defaultValue={preEvent.status}
              className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {preEventStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Fecha confirmada</span>
            <Input name="confirmed_date" type="date" defaultValue={preEvent.confirmed_date ?? ''} />
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Hora confirmada</span>
            <Input name="confirmed_time" type="time" defaultValue={preEvent.confirmed_time ?? ''} />
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Invitados confirmados</span>
            <Input name="confirmed_guests" type="number" min="0" defaultValue={preEvent.confirmed_guests?.toString() ?? ''} />
          </label>

          <label className="space-y-2 text-sm font-medium md:col-span-2">
            <span>Location</span>
            <Input name="location" defaultValue={preEvent.location ?? ''} placeholder="Dirección o ubicación confirmada" />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm">Guardar rápido</Button>
            {state.message ? (
              <p className={cn('text-sm', state.status === 'error' ? 'text-red-600' : 'text-emerald-700')}>{state.message}</p>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="size-4" />
                Solo actualiza los datos operativos esenciales del día a día.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
