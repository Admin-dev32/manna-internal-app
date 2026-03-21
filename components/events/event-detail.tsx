import type { Route } from 'next';
import Link from 'next/link';

import { FinancialSummaryCard } from '@/components/finance/financial-summary-card';
import { EventStatusBadge } from '@/components/events/event-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { EventFinanceSnapshot, EventRecord } from '@/types/events';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value));
}

export function EventDetail({
  event,
  client,
  lead,
  preEvent,
  quote,
  profiles,
  financeSummary,
  canViewFinance,
}: {
  event: EventRecord;
  client: ClientRecord;
  lead: LeadRecord | null;
  preEvent: PreEventRecord;
  quote: QuoteRecord;
  profiles: Record<string, LeadProfileOption>;
  financeSummary: EventFinanceSnapshot | null;
  canViewFinance: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <EventStatusBadge status={event.status} />
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Cliente: {client.full_name}</span>
        </div>
        <div className="mt-4">
          <h1 className="text-3xl font-semibold">Evento real</h1>
          <p className="mt-2 text-sm text-slate-300">Entidad operativa mínima creada desde una reserva lista, conectada a su cotización origen y a su contexto financiero interno.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={'/eventos' as Route}>Ver eventos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/reservas/${preEvent.id}` as Route}>Volver a reserva</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/cotizaciones/${quote.id}` as Route}>Ver cotización origen</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Base operativa del evento</CardTitle>
            <CardDescription>Datos heredados y consolidados al crear el evento real desde la reserva.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Fecha del evento" value={formatDate(event.event_date)} />
            <InfoItem label="Hora del evento" value={event.event_time} />
            <InfoItem label="Location" value={event.location ?? 'Pendiente'} />
            <InfoItem label="Tipo de evento" value={event.event_type ?? 'Pendiente'} />
            <InfoItem label="Servicio contratado" value={event.booked_service} />
            <InfoItem label="Invitados" value={event.guest_count?.toString() ?? 'Pendiente'} />
            <InfoItem label="Reserva origen" value={`#${preEvent.id.slice(0, 8)} · ${preEvent.status}`} />
            <InfoItem label="Cotización origen" value={`#${quote.id.slice(0, 8)} · ${quote.status}`} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Origen del flujo</CardTitle>
              <CardDescription>Trazabilidad completa desde la venta cerrada hasta el evento real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Cliente" value={client.full_name} />
              <SummaryRow label="Lead origen" value={lead?.full_name ?? 'Sin lead ligado'} />
              <SummaryRow label="Reserva origen" value={`#${preEvent.id.slice(0, 8)}`} />
              <SummaryRow label="Cotización origen" value={`#${quote.id.slice(0, 8)}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas operativas</CardTitle>
              <CardDescription>Base mínima para crecer a coordinación operativa completa.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-background p-4 whitespace-pre-wrap text-sm text-foreground">
                {event.operational_notes ?? 'Sin notas operativas registradas.'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad</CardTitle>
              <CardDescription>Registro interno de creación y edición del evento real.</CardDescription>
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
          title="Contexto financiero origen"
          description="Resumen read-only reutilizado desde la hoja financiera de la cotización origen, sin duplicar lógica ni persistencia."
        />
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
