import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, PencilLine, ReceiptText, UserPlus, XCircle } from 'lucide-react';

import { QuoteFinancialSheet } from '@/components/finance/quote-financial-sheet';
import { RecordTimelineSection } from '@/components/communication/record-timeline-section';
import { convertLeadToClientAction } from '@/services/clients/actions';
import { acceptQuoteAction, rejectQuoteAction } from '@/services/quotes/actions';
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { QuoteFinancialSheetDraft } from '@/types/finance';
import type { LeadProfileOption } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteLeadSummary, QuoteRecord } from '@/types/quotes';

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'Sin monto';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function QuoteDetail({
  quote,
  lead,
  profiles,
  client,
  preEvent,
  canViewFinance,
  financialSheetDraft,
}: {
  quote: QuoteRecord;
  lead: QuoteLeadSummary;
  profiles: Record<string, LeadProfileOption>;
  client: ClientRecord | null;
  preEvent: PreEventRecord | null;
  canViewFinance: boolean;
  financialSheetDraft: QuoteFinancialSheetDraft | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <QuoteStatusBadge status={quote.status} />
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Lead: {lead.full_name}</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Cotización comercial</h1>
          <p className="mt-2 text-sm text-slate-300">Total actual: {formatCurrency(quote.total_amount)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/cotizaciones/${quote.id}/editar` as Route}>
              <PencilLine className="size-4" />
              Editar cotización
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/leads/${lead.id}` as Route}>
              <ArrowLeft className="size-4" />
              Volver al lead
            </Link>
          </Button>
          {quote.status !== 'aceptada' ? (
            <form action={acceptQuoteAction.bind(null, quote.id, lead.id)}>
              <Button type="submit" variant="outline" className="border-emerald-300/60 bg-emerald-500/10 text-white hover:bg-emerald-500/20 hover:text-white">
                <CheckCircle2 className="size-4" />
                Marcar aceptada
              </Button>
            </form>
          ) : null}
          {quote.status !== 'rechazada' && !client ? (
            <form action={rejectQuoteAction.bind(null, quote.id, lead.id)}>
              <Button type="submit" variant="outline" className="border-rose-300/60 bg-rose-500/10 text-white hover:bg-rose-500/20 hover:text-white">
                <XCircle className="size-4" />
                Marcar rechazada
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen económico</CardTitle>
            <CardDescription>Base comercial real para dar seguimiento a la propuesta enviada.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Subtotal" value={formatCurrency(quote.subtotal)} />
            <InfoItem label="Descuento" value={formatCurrency(quote.discount_amount)} />
            <InfoItem label="Promoción" value={quote.promotion_note ?? 'Sin promoción'} />
            <InfoItem label="Total cotizado" value={formatCurrency(quote.total_amount)} />
            <InfoItem label="Depósito esperado" value={formatCurrency(quote.expected_deposit)} />
            <InfoItem label="Saldo estimado" value={formatCurrency(quote.estimated_balance)} />
            <InfoItem label="Fecha de envío" value={formatDate(quote.sent_at)} />
            <InfoItem label="Estado del lead" value={lead.status} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversión comercial</CardTitle>
              <CardDescription>Controla el paso posterior a la aceptación sin saltar todavía al módulo completo de clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preEvent ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-medium text-sky-800">Esta venta ya tiene una reserva operativa inicial creada.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button asChild size="sm">
                      <Link href={`/reservas/${preEvent.id}` as Route}>Abrir pre-evento</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/reservas/${preEvent.id}/editar` as Route}>Editar pre-evento</Link>
                    </Button>
                  </div>
                </div>
              ) : client ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800">Este lead ya fue convertido a cliente.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button asChild size="sm">
                      <Link href={`/clientes/${client.id}` as Route}>Abrir cliente</Link>
                    </Button>
                    {quote.status === 'aceptada' ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/cotizaciones/${quote.id}/pre-evento/nuevo` as Route}>Crear pre-evento</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : quote.status === 'aceptada' ? (
                <form action={convertLeadToClientAction.bind(null, lead.id, quote.id)} className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    La cotización ya fue aceptada. Puedes convertir el lead a cliente mediante una acción explícita para mantener control comercial y trazabilidad.
                  </p>
                  <Button type="submit">
                    <UserPlus className="size-4" />
                    Convertir a cliente
                  </Button>
                </form>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Primero acepta la cotización para habilitar la conversión controlada del lead a cliente.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas y seguimiento</CardTitle>
              <CardDescription>Preparado para evolucionar a aprobación, conversión y base de evento más adelante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Observaciones</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{quote.notes ?? 'Sin observaciones registradas.'}</p>
              </div>
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Preparado para siguiente bloque</p>
                <p className="mt-2">Desde aquí podrá derivarse la aceptación comercial, la conversión a cliente y la base para un evento futuro.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad</CardTitle>
              <CardDescription>Quién registró y actualizó esta cotización dentro del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Creada por" value={profiles[quote.created_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Actualizada por" value={profiles[quote.updated_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Creada el" value={formatDate(quote.created_at)} />
              <SummaryRow label="Última actualización" value={formatDate(quote.updated_at)} />
              <SummaryRow label="Resumen en lead" value={formatCurrency(lead.quoted_total)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canViewFinance && financialSheetDraft ? (
        <QuoteFinancialSheet
          quoteId={quote.id}
          initialGrossRevenue={quote.total_amount}
          draft={financialSheetDraft}
          canManage
        />
      ) : null}

      <RecordTimelineSection entityType="quote" entityId={quote.id} returnPath={`/cotizaciones/${quote.id}`} />
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
      <span className="inline-flex items-center gap-2 font-medium text-foreground">
        <ReceiptText className="size-4 text-primary" />
        {value}
      </span>
    </div>
  );
}
