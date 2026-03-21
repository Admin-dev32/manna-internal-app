import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, FileText, PencilLine, Plus } from 'lucide-react';

import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuoteRecord } from '@/types/quotes';

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'Sin monto';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function LeadQuotesPanel({ leadId, quotes }: { leadId: string; quotes: QuoteRecord[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Cotizaciones del lead</CardTitle>
          <CardDescription>Registra propuestas reales, revisa su estado y vuelve al seguimiento comercial sin salir del contexto del lead.</CardDescription>
        </div>
        <Button asChild>
          <Link href={`/leads/${leadId}/cotizaciones/nueva` as Route}>
            <Plus className="size-4" />
            Nueva cotización
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Aún no hay cotizaciones ligadas a este lead. Crea la primera propuesta comercial desde aquí.
          </div>
        ) : (
          quotes.map((quote) => (
            <div key={quote.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <QuoteStatusBadge status={quote.status} />
                    <span className="text-xs text-muted-foreground">Creada el {formatDate(quote.created_at)}</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(quote.total_amount)}</p>
                  <p className="text-sm text-muted-foreground">Depósito esperado: {formatCurrency(quote.expected_deposit)}</p>
                  <p className="text-sm text-muted-foreground">Saldo estimado: {formatCurrency(quote.estimated_balance)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:w-[180px]">
                  <Button asChild size="sm">
                    <Link href={`/cotizaciones/${quote.id}` as Route}>
                      <FileText className="size-4" />
                      Ver detalle
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/cotizaciones/${quote.id}/editar` as Route}>
                      <PencilLine className="size-4" />
                      Editar
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/cotizaciones/${quote.id}` as Route}>
                      Abrir cotización
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
