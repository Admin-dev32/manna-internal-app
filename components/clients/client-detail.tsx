import type { Route } from 'next';
import Link from 'next/link';

import type { PreEventRecord } from '@/types/pre-events';
import type { LeadProfileOption } from '@/types/leads';
import type { ClientRecord } from '@/types/clients';
import { RecordTimelineSection } from '@/components/communication/record-timeline-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function ClientDetail({ client, profiles, preEvent }: { client: ClientRecord; profiles: Record<string, LeadProfileOption>; preEvent: PreEventRecord | null }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Cliente creado desde lead</h1>
            <p className="mt-2 text-sm text-slate-300">Base mínima para la futura administración completa de clientes y su relación con eventos.</p>
          </div>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={'/clientes' as Route}>Volver a clientes</Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del cliente</CardTitle>
          <CardDescription>Información principal conservada desde el lead original.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoItem label="Nombre" value={client.full_name} />
          <InfoItem label="Teléfono" value={client.phone ?? 'No capturado'} />
          <InfoItem label="Email" value={client.email ?? 'No capturado'} />
          <InfoItem label="Idioma" value={client.preferred_language ?? 'Sin definir'} />
          <InfoItem label="Ubicación" value={client.location ?? 'Sin definir'} />
          <InfoItem label="Lead original" value={client.lead_id} />
          <InfoItem label="Cotización origen" value={client.source_quote_id ?? 'Sin cotización ligada'} />
          <InfoItem label="Creado el" value={formatDate(client.created_at)} />
          <InfoItem label="Creado por" value={profiles[client.created_by]?.full_name ?? 'Usuario interno'} />
          <InfoItem label="Última edición" value={profiles[client.updated_by]?.full_name ?? 'Usuario interno'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reserva operativa inicial</CardTitle>
          <CardDescription>Puente ligero entre la venta cerrada y la futura planeación completa del evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preEvent ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">Ya existe un pre-evento ligado a este cliente.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link href={`/reservas/${preEvent.id}` as Route}>Abrir pre-evento</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/reservas/${preEvent.id}/editar` as Route}>Editar pre-evento</Link>
                </Button>
              </div>
            </div>
          ) : client.source_quote_id ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p>Aún no existe una reserva operativa inicial para este cliente.</p>
              <Button asChild className="mt-3" size="sm">
                <Link href={`/cotizaciones/${client.source_quote_id}/pre-evento/nuevo` as Route}>Crear pre-evento</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Este cliente no tiene cotización origen disponible para crear una reserva operativa inicial.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas base</CardTitle>
          <CardDescription>Este espacio queda listo para crecer al módulo completo de Clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl bg-background p-4 text-sm text-foreground whitespace-pre-wrap">{client.notes ?? 'Sin notas trasladadas desde el lead.'}</div>
        </CardContent>
      </Card>

      <RecordTimelineSection entityType="client" entityId={client.id} returnPath={`/clientes/${client.id}`} />
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
