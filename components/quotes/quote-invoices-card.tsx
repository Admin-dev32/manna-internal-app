'use client';

import { useActionState } from 'react';
import { FilePlus2, ReceiptText } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialInvoiceFormState } from '@/services/invoices/form-state';
import type { InvoiceFormState } from '@/services/invoices/form-state';
import type { InvoiceRecord } from '@/types/invoices';

function formatMoney(value: number | string | null) {
  if (value === null || value === '') return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function QuoteInvoicesCard({
  invoices,
  canManage,
  quoteAccepted,
  action,
}: {
  invoices: InvoiceRecord[];
  canManage: boolean;
  quoteAccepted: boolean;
  action: (state: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
}) {
  const [state, formAction] = useActionState(action, initialInvoiceFormState);
  const latest = invoices[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice después de aceptación</CardTitle>
        <CardDescription>Emite invoice interno desde la cotización aceptada y congela snapshots económicos/operativos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthFeedback state={state} />

        {canManage ? (
          <form action={formAction} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Fecha de vencimiento
                <input
                  type="datetime-local"
                  name="due_at"
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Nota para cliente (opcional)
                <input
                  type="text"
                  name="notes"
                  placeholder="Gracias por su preferencia"
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Nota interna (opcional)
              <textarea
                name="internal_notes"
                rows={2}
                placeholder="Comentarios internos del área de finanzas"
                className="w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <Button type="submit" disabled={!quoteAccepted}>
              <FilePlus2 className="size-4" />
              Emitir invoice
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            No tienes permisos para emitir invoices.
          </div>
        )}

        {!quoteAccepted ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Primero marca la cotización como <strong>aceptada</strong> para habilitar la emisión de invoice.
          </div>
        ) : null}

        {latest ? (
          <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Último invoice</Badge>
              <Badge variant="outline">{latest.invoice_number}</Badge>
              <Badge variant="outline">{latest.status}</Badge>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>Total: {formatMoney(latest.total_amount)}</p>
              <p>Depósito: {formatMoney(latest.deposit_amount)}</p>
              <p>Saldo: {formatMoney(latest.balance_due)}</p>
              <p>Emitida: {formatDateTime(latest.issued_at)}</p>
              <p>Vence: {formatDateTime(latest.due_at)}</p>
              <p>Moneda: {String(latest.currency).toUpperCase()}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Esta cotización todavía no tiene invoice emitida.
          </div>
        )}

        {invoices.length > 1 ? (
          <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Historial reciente</p>
            {invoices.slice(1, 4).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <span>{invoice.invoice_number}</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <ReceiptText className="size-4 text-primary" />
                  {formatMoney(invoice.total_amount)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
