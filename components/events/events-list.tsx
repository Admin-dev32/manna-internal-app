import type { Route } from 'next';
import Link from 'next/link';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord } from '@/types/events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value));
}

export function EventsList({
  events,
  clients,
  quotes,
}: {
  events: EventRecord[];
  clients: Record<string, ClientRecord>;
  quotes: Record<string, Pick<QuoteRecord, 'id' | 'status'>>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <h1 className="text-3xl font-semibold">Eventos reales</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Base operativa real creada desde reservas listas. Aquí vive el evento confirmado sin duplicar el contexto financiero de la cotización origen.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Eventos activos</CardTitle>
          <CardDescription>Listado mínimo navegable para cerrar el flujo comercial → reserva → evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Aún no hay eventos creados. Convierte una reserva lista para inaugurar este bloque operativo.
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-3xl border border-border bg-background p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <EventStatusBadge status={event.status} />
                      <span className="text-sm text-muted-foreground">Cliente: {clients[event.client_id]?.full_name ?? 'Cliente interno'}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-foreground">{event.event_type ?? 'Evento confirmado'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(event.event_date)} · {event.event_time} · {event.location ?? 'Location pendiente'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Servicio: {event.booked_service} · Cotización origen #{quotes[event.source_quote_id]?.id.slice(0, 8) ?? event.source_quote_id.slice(0, 8)}
                    </p>
                  </div>

                  <Button asChild>
                    <Link href={`/eventos/${event.id}` as Route}>Abrir evento</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
