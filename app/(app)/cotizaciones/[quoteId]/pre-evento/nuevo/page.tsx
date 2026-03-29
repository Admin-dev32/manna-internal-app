import type { Route } from 'next';
import Link from 'next/link';

import { PreEventForm } from '@/components/pre-events/pre-event-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createPreEventAction } from '@/services/pre-events/actions';
import { getPreEventCreatePageDataFromQuote } from '@/services/pre-events/queries';

export default async function NewPreEventPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { client, existingPreEvent, lead, quote } = await getPreEventCreatePageDataFromQuote(quoteId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Nuevo pre-evento</h1>
          <p className="mt-2 text-sm text-muted-foreground">Reserva operativa inicial ligada al cliente {client.full_name} y a la cotización aceptada.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/cotizaciones/${quoteId}` as Route}>Volver a la cotización</Link>
        </Button>
      </div>

      {existingPreEvent ? (
        <Card>
          <CardHeader>
            <CardTitle>Ya existe una reserva inicial</CardTitle>
            <CardDescription>Esta cotización aceptada ya generó un pre-evento. Puedes abrirlo directamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/reservas/${existingPreEvent.id}` as Route}>Abrir pre-evento existente</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Preparación operativa inicial</CardTitle>
            <CardDescription>Confirma la información mínima para reservar el trabajo antes del módulo completo de Eventos.</CardDescription>
          </CardHeader>
          <CardContent>
            <PreEventForm action={createPreEventAction.bind(null, client.id, lead.id, quote.id)} client={client} lead={lead} quote={quote} submitLabel="Crear pre-evento" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
