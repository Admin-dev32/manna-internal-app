import Link from 'next/link';

import { QuoteForm } from '@/components/quotes/quote-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createQuoteAction } from '@/services/quotes/actions';
import { getQuoteCreatePageData } from '@/services/quotes/queries';

export default async function NewLeadQuotePage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { lead, quotes } = await getQuoteCreatePageData(leadId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Nueva cotización</h1>
          <p className="mt-2 text-sm text-muted-foreground">Crea una propuesta comercial real ligada a {lead.full_name}.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/leads/${leadId}`}>Volver al lead</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contexto rápido del lead</CardTitle>
          <CardDescription>Este lead ya tiene {quotes.length} cotización(es) registrada(s) y un total resumido de {lead.quoted_total ? `$${Number(lead.quoted_total).toFixed(2)}` : 'sin monto consolidado'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteForm action={createQuoteAction.bind(null, leadId)} lead={lead} submitLabel="Crear cotización" />
        </CardContent>
      </Card>
    </div>
  );
}
