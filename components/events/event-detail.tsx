import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Circle, Clock3, FileText, MapPin, Users } from 'lucide-react';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { FinancialSummaryCard } from '@/components/finance/financial-summary-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_STATUS_DESCRIPTIONS, EVENT_STATUS_LABELS, EVENT_STATUS_TRANSITIONS } from '@/config/events';
import { updateEventOperationalNotesAction, updateEventStatusAction, toggleEventChecklistItemAction } from '@/services/events/actions';
import type { ClientRecord } from '@/types/clients';
import type { EventChecklistItemRecord, EventChecklistProgress, EventFinanceSnapshot, EventRecord } from '@/types/events';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`));
}

export function EventDetail({
  event,
  client,
  lead,
  preEvent,
  quote,
  checklistItems,
  checklistProgress,
  profiles,
  financeSummary,
  canViewFinance,
}: {
  event: EventRecord;
  client: ClientRecord;
  lead: LeadRecord | null;
  preEvent: PreEventRecord;
  quote: QuoteRecord;
  checklistItems: EventChecklistItemRecord[];
  checklistProgress: EventChecklistProgress;
  profiles: Record<string, LeadProfileOption>;
  financeSummary: EventFinanceSnapshot | null;
  canViewFinance: boolean;
}) {
  const allowedTransitions = EVENT_STATUS_TRANSITIONS[event.status];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <EventStatusBadge status={event.status} />
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Cliente: {client.full_name}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Servicio: {event.booked_service}</span>
        </div>
        <div className="mt-4">
          <h1 className="text-3xl font-semibold">{event.event_type ?? 'Evento operativo'}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Herramienta operativa real para coordinar preparación, seguimiento y cierre del evento sin tocar el contexto comercial original.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={'/eventos' as Route}>Ver agenda operativa</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/reservas/${preEvent.id}` as Route}>Volver a reserva</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/cotizaciones/${quote.id}` as Route}>Ver cotización origen</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalle operativo</CardTitle>
              <CardDescription>Información principal para ejecutar el evento en operación diaria.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem icon={Users} label="Cliente" value={client.full_name} />
              <InfoItem icon={CalendarClock} label="Fecha y hora" value={`${formatDate(event.event_date)} · ${event.event_time}`} />
              <InfoItem icon={MapPin} label="Dirección" value={event.location ?? 'Pendiente de definir'} />
              <InfoItem icon={FileText} label="Tipo de evento" value={event.event_type ?? 'Pendiente'} />
              <InfoItem icon={FileText} label="Servicio contratado" value={event.booked_service} />
              <InfoItem icon={Users} label="Invitados" value={event.guest_count?.toString() ?? 'Pendiente'} />
              <InfoItem icon={Clock3} label="Estado del evento" value={EVENT_STATUS_LABELS[event.status]} />
              <InfoItem icon={FileText} label="Origen" value={`Lead ${lead ? `#${lead.id.slice(0, 8)}` : 'sin lead'} · Quote #${quote.id.slice(0, 8)} · Reserva #${preEvent.id.slice(0, 8)}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist operativa</CardTitle>
              <CardDescription>Base mínima para preparación real del evento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{checklistProgress.completed}/{checklistProgress.total} completos</Badge>
                <Badge variant={checklistProgress.pending > 0 ? 'warning' : 'success'}>
                  {checklistProgress.pending > 0 ? `${checklistProgress.pending} pendientes` : 'Checklist completa'}
                </Badge>
              </div>
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <form key={item.id} action={toggleEventChecklistItemAction.bind(null, event.id, item.id, !item.is_completed)}>
                    <button
                      type="submit"
                      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <span className="mt-0.5 text-primary">
                        {item.is_completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{item.description ?? 'Sin descripción adicional.'}</span>
                      </span>
                      <Badge variant={item.is_completed ? 'success' : 'outline'}>{item.is_completed ? 'Completo' : 'Pendiente'}</Badge>
                    </button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas internas operativas</CardTitle>
              <CardDescription>Separadas del contexto comercial original para coordinación del evento.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateEventOperationalNotesAction.bind(null, event.id)} className="space-y-4">
                <Textarea
                  name="operational_notes"
                  rows={8}
                  defaultValue={event.operational_notes ?? ''}
                  placeholder="Ejemplo: acceso de carga, contacto onsite, restricciones del venue, setup especial..."
                />
                <div className="flex justify-end">
                  <Button type="submit">Guardar notas operativas</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estados del evento</CardTitle>
              <CardDescription>{EVENT_STATUS_DESCRIPTIONS[event.status]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado actual</p>
                <div className="mt-3 flex items-center gap-2">
                  <EventStatusBadge status={event.status} />
                  <span className="text-sm text-muted-foreground">Transiciones disponibles según el estado actual.</span>
                </div>
              </div>
              {allowedTransitions.length > 0 ? (
                <div className="grid gap-3">
                  {allowedTransitions.map((nextStatus) => (
                    <form key={nextStatus} action={updateEventStatusAction.bind(null, event.id, nextStatus)}>
                      <Button type="submit" variant="outline" className="w-full justify-between">
                        Mover a {EVENT_STATUS_LABELS[nextStatus]}
                        <span className="text-xs text-muted-foreground">{EVENT_STATUS_DESCRIPTIONS[nextStatus]}</span>
                      </Button>
                    </form>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  Este evento ya está en un estado final y no tiene transiciones configuradas en esta iteración.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Origen del flujo</CardTitle>
              <CardDescription>Trazabilidad desde venta hasta operación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Lead origen" value={lead ? `${lead.full_name} · #${lead.id.slice(0, 8)}` : 'Sin lead ligado'} />
              <SummaryRow label="Cotización origen" value={`#${quote.id.slice(0, 8)} · ${quote.status}`} />
              <SummaryRow label="Reserva origen" value={`#${preEvent.id.slice(0, 8)} · ${preEvent.status}`} />
              <SummaryRow label="Cliente" value={client.full_name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad</CardTitle>
              <CardDescription>Registro interno del evento operativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Creado por" value={profiles[event.created_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Última edición" value={profiles[event.updated_by]?.full_name ?? 'Usuario interno'} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canViewFinance && financeSummary ? (
        <FinancialSummaryCard
          summary={financeSummary}
          title="Resumen financiero read-only"
          description="Se reutiliza la hoja financiera existente de la cotización origen cuando el usuario tiene permiso financiero."
        />
      ) : null}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-background px-4 py-3">
      <span>{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
