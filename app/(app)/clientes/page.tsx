import type { Route } from 'next';
import Link from 'next/link';

import { PreEventStatusBadge } from '@/components/pre-events/pre-event-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/guards';
import { getCommunicationLanguageLabel } from '@/services/communication/language';
import { getClientsOverviewPageData } from '@/services/clients/queries';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default async function ClientesPage() {
  await requirePermission('crm.view');
  const { clients, preEventsByClientId } = await getClientsOverviewPageData();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Clientes mínimos</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Vista operativa de los clientes ya convertidos desde una venta aceptada. Desde aquí puedes abrir su detalle y revisar si ya tienen reserva inicial.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Clientes convertidos recientemente</CardTitle>
          <CardDescription>Acceso directo a clientes mínimos ya creados dentro del flujo comercial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {clients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Aún no hay clientes convertidos. Convierte un lead desde una cotización aceptada para verlo aquí.
            </div>
          ) : (
            clients.map((client) => {
              const preEvent = preEventsByClientId[client.id] ?? null;

              return (
                <div key={client.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-foreground">{client.full_name}</span>
                      {preEvent ? <PreEventStatusBadge status={preEvent.status} /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {client.email ?? 'Sin email'} · {client.phone ?? 'Sin teléfono'}
                    </p>
                    <p className="text-sm text-muted-foreground">Idioma preferido: {getCommunicationLanguageLabel(client.preferred_language)}</p>
                    <p className="text-sm text-muted-foreground">Creado el {formatDate(client.created_at)}</p>
                    <p className="text-sm text-muted-foreground">
                      {preEvent ? 'Ya cuenta con reserva inicial ligada.' : 'Aún no tiene reserva inicial ligada.'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:w-[240px]">
                    <Button asChild size="sm">
                      <Link href={`/clientes/${client.id}` as Route}>Ver cliente</Link>
                    </Button>
                    {preEvent ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reservas/${preEvent.id}` as Route}>Ver reserva inicial</Link>
                      </Button>
                    ) : client.source_quote_id ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/cotizaciones/${client.source_quote_id}/pre-evento/nuevo` as Route}>Crear reserva inicial</Link>
                      </Button>
                    ) : null}
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
