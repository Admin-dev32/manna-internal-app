import type { Route } from 'next';
import Link from 'next/link';

import { createEventFromPreEventAction } from '@/services/events/actions';
import { createPreEventPaymentLinkAction, syncPreEventToGoogleCalendarAction } from '@/services/pre-events/actions';
import { FinancialSummaryCard } from '@/components/finance/financial-summary-card';
import { PaymentStatusBadge } from '@/components/finance/payment-status-badge';
import { BookingStatusTimeline } from '@/components/pre-events/booking-status-timeline';
import { InvoiceLikeSummary } from '@/components/pre-events/invoice-like-summary';
import { PaymentLinksPanel } from '@/components/pre-events/payment-links-panel';
import { PaymentSummaryCard } from '@/components/pre-events/payment-summary-card';
import { PreEventCalendarSyncCard } from '@/components/pre-events/pre-event-calendar-sync-card';
import { PreEventPaymentLinksCard } from '@/components/pre-events/pre-event-payment-links-card';
import { PreEventStatusBadge } from '@/components/pre-events/pre-event-status-badge';
import { RecordTimelineSection } from '@/components/communication/record-timeline-section';
import { EventTemplateSection } from '@/components/templates/event-template-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { EventFinanceSnapshot, EventRecord } from '@/types/events';
import { getPaymentStatus } from '@/lib/finance/payment-status';
import type { InvoiceRecord } from '@/types/invoices';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type {
  EventOperationalTemplateApplicationRecord,
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';
import type { PaymentLinkRecord } from '@/types/payments';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';
import { getPreEventReadyState } from '@/lib/events/readiness';
import type { EventCalendarSyncRecord } from '@/types/calendar';
import { validatePreEventCalendarRequirements } from '@/services/pre-events/calendar';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'Pendiente';
}

function getPendingItems(preEvent: PreEventRecord) {
  const items: string[] = [];
  if (!preEvent.confirmed_date) items.push('Definir fecha confirmada');
  if (!preEvent.confirmed_time) items.push('Definir hora confirmada');
  if (!preEvent.location) items.push('Confirmar location');
  if (!preEvent.confirmed_guests) items.push('Confirmar invitados');
  if (!preEvent.booked_service) items.push('Confirmar servicio contratado');
  return items;
}

export function PreEventDetail({
  preEvent,
  client,
  lead,
  quote,
  paymentLinks,
  profiles,
  linkedEvent,
  applicableOperationalTemplates,
  operationalTemplateApplications,
  operationalTemplateProfiles,
  financeSummary,
  canViewFinance,
  calendarSync,
  latestInvoice,
}: {
  preEvent: PreEventRecord;
  client: ClientRecord;
  lead: LeadRecord | null;
  quote: QuoteRecord;
  paymentLinks: PaymentLinkRecord[];
  profiles: Record<string, LeadProfileOption>;
  linkedEvent: EventRecord | null;
  applicableOperationalTemplates: Array<{
    template: {
      id: string;
      name: string;
      slug: string;
      service_category: string | null;
      event_type: string | null;
      note: string | null;
    };
    checklistItems: OperationalTemplateChecklistItemRecord[];
    taskItems: OperationalTemplateTaskItemRecord[];
    materialItems: OperationalTemplateMaterialItemRecord[];
  }>;
  operationalTemplateApplications: EventOperationalTemplateApplicationRecord[];
  operationalTemplateProfiles: Record<string, LeadProfileOption>;
  financeSummary: EventFinanceSnapshot | null;
  canViewFinance: boolean;
  calendarSync: EventCalendarSyncRecord | null;
  latestInvoice: InvoiceRecord | null;
}) {
  const pendingItems = getPendingItems(preEvent);
  const readyState = getPreEventReadyState(preEvent);
  const paymentLinkAction = createPreEventPaymentLinkAction.bind(null, preEvent.id);
  const calendarSyncAction = syncPreEventToGoogleCalendarAction.bind(null, preEvent.id);
  const calendarRequirements = validatePreEventCalendarRequirements(preEvent, client);
  const paymentStatus = getPaymentStatus({
    preEventStatus: preEvent.status,
    quoteTotalAmount: quote.total_amount,
    expectedDeposit: quote.expected_deposit,
    estimatedBalance: quote.estimated_balance,
    invoices: latestInvoice ? [latestInvoice] : [],
    paymentLinks,
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <PreEventStatusBadge status={preEvent.status} />
          <PaymentStatusBadge result={paymentStatus} />
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Cliente: {client.full_name}</span>
        </div>
        <div className="mt-4">
          <h1 className="text-3xl font-semibold">Reserva operativa inicial</h1>
          <p className="mt-2 text-sm text-slate-300">Puente entre venta cerrada y operación futura, todavía sin entrar al módulo completo de Eventos.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/reservas/${preEvent.id}/editar` as Route}>Editar pre-evento</Link>
          </Button>
          {linkedEvent ? (
            <Button asChild variant="secondary">
              <Link href={`/eventos/${linkedEvent.id}` as Route}>Abrir evento creado</Link>
            </Button>
          ) : readyState.isReady ? (
            <form action={createEventFromPreEventAction.bind(null, preEvent.id)}>
              <Button type="submit" variant="secondary">Crear evento</Button>
            </form>
          ) : null}
          <Button asChild variant="outline">
            <Link href={'/reservas' as Route}>Ver reservas</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/clientes/${client.id}` as Route}>Volver al cliente</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PaymentSummaryCard totalExpected={quote.total_amount} expectedDeposit={quote.expected_deposit} paymentStatus={paymentStatus} />
        <InvoiceLikeSummary client={client} quote={quote} invoice={latestInvoice} linkedEvent={linkedEvent} />
        <PaymentLinksPanel paymentLinks={paymentLinks} />
        <BookingStatusTimeline
          quote={quote}
          preEvent={preEvent}
          latestInvoice={latestInvoice}
          paymentLinks={paymentLinks}
          linkedEvent={linkedEvent}
          paymentStatus={paymentStatus}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Reserva confirmada hasta ahora</CardTitle>
            <CardDescription>Lo ya heredado y confirmado para iniciar trabajo operativo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Fecha confirmada" value={formatDate(preEvent.confirmed_date)} />
            <InfoItem label="Hora confirmada" value={preEvent.confirmed_time ?? 'Pendiente'} />
            <InfoItem label="Location" value={preEvent.location ?? 'Pendiente'} />
            <InfoItem label="Tipo de evento" value={preEvent.event_type ?? 'Pendiente'} />
            <InfoItem label="Servicio contratado" value={preEvent.booked_service ?? 'Pendiente'} />
            <InfoItem label="Invitados confirmados" value={preEvent.confirmed_guests?.toString() ?? 'Pendiente'} />
            <InfoItem label="Cotización origen" value={`#${quote.id.slice(0, 8)} · ${quote.status}`} />
            <InfoItem label="Lead origen" value={lead?.full_name ?? 'Sin lead ligado'} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checklist operativo pendiente</CardTitle>
              <CardDescription>Datos que aún faltan para dejar la reserva lista como base del futuro módulo de Eventos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {pendingItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  Esta reserva ya tiene completos los datos operativos esenciales.
                </div>
              ) : (
                pendingItems.map((item) => (
                  <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                    {item}
                  </div>
                ))
              )}
              {!linkedEvent && !readyState.isReady ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-muted-foreground">
                  Completa los requisitos mínimos para habilitar la conversión a evento real.
                </div>
              ) : null}
              {!linkedEvent && readyState.isReady ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  Esta reserva ya está lista para convertirse en evento real.
                </div>
              ) : null}
              {linkedEvent ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800">
                  Esta reserva ya fue convertida en el evento #{linkedEvent.id.slice(0, 8)}.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Origen comercial</CardTitle>
              <CardDescription>Conexión directa con el cliente y la cotización aceptada que originaron esta reserva.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Cliente origen" value={client.full_name} />
              <SummaryRow label="Cotización origen" value={`#${quote.id.slice(0, 8)} · ${quote.status}`} />
              <SummaryRow label="Lead ligado" value={lead?.full_name ?? 'Sin lead ligado'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen del cliente</CardTitle>
              <CardDescription>Contexto heredado del flujo comercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Cliente" value={client.full_name} />
              <SummaryRow label="Email" value={client.email ?? 'No capturado'} />
              <SummaryRow label="Teléfono" value={client.phone ?? 'No capturado'} />
              <SummaryRow label="Cotización aceptada" value={quote.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas operativas iniciales</CardTitle>
              <CardDescription>Base lista para crecer después a planeación completa.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-background p-4 text-sm text-foreground whitespace-pre-wrap">{preEvent.initial_operations_notes ?? 'Sin notas operativas registradas.'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad</CardTitle>
              <CardDescription>Registro base de creación y edición interna.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Creado por" value={profiles[preEvent.created_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Última edición" value={profiles[preEvent.updated_by]?.full_name ?? 'Usuario interno'} />
            </CardContent>
          </Card>

          <PreEventPaymentLinksCard action={paymentLinkAction} paymentLinks={paymentLinks} />
          <PreEventCalendarSyncCard action={calendarSyncAction} requirements={calendarRequirements} sync={calendarSync} />
        </div>
      </div>

      <EventTemplateSection
        eventId={linkedEvent?.id ?? preEvent.id}
        preEventId={preEvent.id}
        templates={applicableOperationalTemplates}
        applications={operationalTemplateApplications}
        profiles={operationalTemplateProfiles}
        disabledReason={linkedEvent ? undefined : 'Primero convierte la reserva en evento para poder aplicar checklist, tareas y materiales reales.'}
      />

      <RecordTimelineSection entityType="pre_event" entityId={preEvent.id} returnPath={`/reservas/${preEvent.id}`} />

      {canViewFinance && financeSummary ? (
        <FinancialSummaryCard
          summary={financeSummary}
          title="Contexto financiero origen"
          description="Resumen read-only reutilizado desde la hoja financiera de la cotización origen, sin duplicar cálculos en la reserva."
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
