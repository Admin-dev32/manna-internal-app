import type { Route } from 'next';
import Link from 'next/link';

import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getQuotesOverviewPageData } from '@/services/quotes/queries';

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'Sin monto';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default async function CotizacionesPage() {
  const { leads, quotes } = await getQuotesOverviewPageData();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Cotizaciones comerciales</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Primera versión funcional del flujo de cotización ligado a leads. Desde aquí puedes revisar propuestas recientes y volver al lead para seguir operando.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente de cotizaciones</CardTitle>
          <CardDescription>Las nuevas cotizaciones se crean desde el detalle de cada lead para mantener el contexto comercial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Aún no hay cotizaciones registradas. Entra al detalle de un lead para crear la primera propuesta.
            </div>
          ) : (
            quotes.map((quote) => (
              <div key={quote.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <QuoteStatusBadge status={quote.status} />
                    <span className="text-sm font-medium text-foreground">{leads[quote.lead_id]?.full_name ?? 'Lead vinculado'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Creada el {formatDate(quote.created_at)}</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(quote.total_amount)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:w-[220px]">
                  <Button asChild size="sm">
                    <Link href={`/cotizaciones/${quote.id}` as Route}>Ver cotización</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/leads/${quote.lead_id}`}>Volver al lead</Link>
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
