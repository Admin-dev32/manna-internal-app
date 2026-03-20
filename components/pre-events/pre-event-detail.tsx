import type { Route } from 'next';
import Link from 'next/link';

import { PreEventStatusBadge } from '@/components/pre-events/pre-event-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'Pendiente';
}

export function PreEventDetail({ preEvent, client, lead, quote, profiles }: { preEvent: PreEventRecord; client: ClientRecord; lead: LeadRecord | null; quote: QuoteRecord; profiles: Record<string, LeadProfileOption> }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <PreEventStatusBadge status={preEvent.status} />
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
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/clientes/${client.id}` as Route}>Volver al cliente</Link>
          </Button>
        </div>
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
        </div>
      </div>
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
