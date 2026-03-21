import type { Route } from 'next';
import Link from 'next/link';

import { QuoteForm } from '@/components/quotes/quote-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateQuoteAction } from '@/services/quotes/actions';
import { getQuoteEditPageData } from '@/services/quotes/queries';

export default async function EditQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { lead, quote } = await getQuoteEditPageData(quoteId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Editar cotización</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ajusta estado, total, depósito esperado y notas comerciales del lead {lead.full_name}.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/cotizaciones/${quoteId}` as Route}>Volver al detalle</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edición comercial básica</CardTitle>
          <CardDescription>Preparado para crecer a versión formal, aceptación y conexión con eventos más adelante.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteForm action={updateQuoteAction.bind(null, quoteId, lead.id)} lead={lead} quote={quote} submitLabel="Guardar cotización" />
        </CardContent>
      </Card>
    </div>
  );
}
