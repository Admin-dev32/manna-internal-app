import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceEmailPanel } from '@/components/finance/invoice-email-panel';
import { InvoicePaymentsPanel } from '@/components/finance/invoice-payments-panel';
import type { InvoicePaymentSummary } from '@/lib/finance/invoice-payments';
import type { FinanceInvoiceDetail } from '@/services/invoices/queries';
import type { InvoiceEmailDeliveryRecord, InvoicePaymentRecord } from '@/types/invoices';

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusVariant(status: FinanceInvoiceDetail['invoice']['status']) {
  if (status === 'paid') return 'default';
  if (status === 'partially_paid') return 'secondary';
  if (status === 'void') return 'warning';
  return 'outline';
}

export function FinanceInvoiceDetailPanel({
  detail,
  deliveries,
  canManageInvoices,
  payments,
  paymentSummary,
  canManagePayments,
  depositAccounts,
}: {
  detail: FinanceInvoiceDetail;
  deliveries: InvoiceEmailDeliveryRecord[];
  canManageInvoices: boolean;
  payments: InvoicePaymentRecord[];
  paymentSummary: InvoicePaymentSummary;
  canManagePayments: boolean;
  depositAccounts: Array<{ id: string; code: string; name: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice detail · {detail.invoice.invoice_number}</CardTitle>
        <CardDescription>Centralized read-only invoice view from Finanzas.</CardDescription>
        <div>
          <Link href="/finanzas/invoices" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to invoices
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Invoice Summary</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(detail.invoice.status)}>{detail.invoice.status}</Badge>
          <Badge variant="secondary">{detail.source_label}</Badge>
          {detail.invoice.quote_id ? <Badge variant="outline">Quote #{detail.invoice.quote_id.slice(0, 8)}</Badge> : null}
          {detail.preEvent ? <Badge variant="outline">Reserva #{detail.preEvent.id.slice(0, 8)}</Badge> : null}
          {detail.event ? <Badge variant="outline">Evento #{detail.event.id.slice(0, 8)}</Badge> : null}
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
          <Field label="Client" value={detail.client?.full_name ?? 'Cliente no ligado'} />
          <Field label="Client email" value={detail.client?.email ?? 'N/D'} />
          <Field label="Quote status" value={detail.quote?.status ?? 'N/D'} />
          <Field label="Reservation status" value={detail.preEvent?.status ?? 'N/D'} />
          <Field label="Event status" value={detail.event?.status ?? 'N/D'} />
          <Field label="Subtotal" value={formatCurrency(detail.invoice.subtotal)} />
          <Field label="Discount" value={formatCurrency(detail.invoice.discount_amount)} />
          <Field label="Total" value={formatCurrency(detail.invoice.total_amount)} />
          <Field label="Deposit" value={formatCurrency(detail.invoice.deposit_amount)} />
          <Field label="Balance due" value={formatCurrency(detail.invoice.balance_due)} />
          <Field label="Issued at" value={formatDateTime(detail.invoice.issued_at)} />
          <Field label="Due at" value={formatDateTime(detail.invoice.due_at)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Client notes" value={detail.invoice.notes ?? 'Sin notas para cliente.'} />
          <Field label="Internal notes" value={detail.invoice.internal_notes ?? 'Sin notas internas.'} />
        </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Payment Records</h3>
        <InvoicePaymentsPanel
          invoiceId={detail.invoice.id}
          payments={payments}
          summary={paymentSummary}
          canManagePayments={canManagePayments}
          depositAccounts={depositAccounts}
        />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email Delivery</h3>
          <InvoiceEmailPanel detail={detail} deliveries={deliveries} canManageInvoices={canManageInvoices} />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Payment Links</h3>
        <div className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Payment links related channels</p>
          <p className="text-sm text-amber-700">
            Payment links are collection channels and do not confirm payment by themselves.
          </p>
          {detail.paymentLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related payment links were found for this invoice.</p>
          ) : (
            <div className="space-y-2">
              {detail.paymentLinks.map((link) => (
                <div key={link.id} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">
                    {link.source_record_type} · {link.payment_mode}
                  </p>
                  <p className="text-muted-foreground">
                    Charge: {formatCurrency(link.amount_to_charge)} · Balance: {formatCurrency(link.balance_due)} · Created: {formatDateTime(link.created_at)}
                  </p>
                  <a href={link.external_url} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                    Open payment link
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
        </section>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
