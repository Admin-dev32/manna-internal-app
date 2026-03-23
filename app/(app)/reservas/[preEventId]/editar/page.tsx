import type { Route } from 'next';
import Link from 'next/link';

import { PreEventForm } from '@/components/pre-events/pre-event-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updatePreEventAction } from '@/services/pre-events/actions';
import { getPreEventEditPageData } from '@/services/pre-events/queries';

export default async function EditPreEventPage({ params }: { params: Promise<{ preEventId: string }> }) {
  const { preEventId } = await params;
  const { client, lead, preEvent, quote } = await getPreEventEditPageData(preEventId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Editar pre-evento</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ajusta la reserva operativa inicial antes de pasar al módulo completo de Eventos.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/reservas/${preEventId}` as Route}>Volver al detalle</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edición operativa</CardTitle>
          <CardDescription>Mantén actualizada la información confirmada del servicio reservado.</CardDescription>
        </CardHeader>
        <CardContent>
          <PreEventForm action={updatePreEventAction.bind(null, preEventId, lead?.id ?? null, client.id, quote.id)} client={client} lead={lead} quote={quote} preEvent={preEvent} submitLabel="Guardar pre-evento" />
        </CardContent>
      </Card>
    </div>
  );
}
