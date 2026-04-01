'use client';

import { useActionState, useState } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialPreEventPaymentLinkFormState } from '@/services/pre-events/payment-link-form-state';
import type { PreEventPaymentLinkFormState } from '@/services/pre-events/payment-link-form-state';
import type { PaymentLinkRecord } from '@/types/payments';

function formatMoney(value: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parsed);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

interface PreEventPaymentLinksCardProps {
  action: (state: PreEventPaymentLinkFormState, formData: FormData) => Promise<PreEventPaymentLinkFormState>;
  paymentLinks: PaymentLinkRecord[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  historyTitle?: string;
}

export function PreEventPaymentLinksCard({
  action,
  paymentLinks,
  title = 'Cobros de reserva',
  description = 'Genera payment links desde la API central de pagos (compatible con el sistema maestro de webhooks).',
  emptyMessage = 'Esta reserva todavía no tiene payment links registrados.',
  historyTitle = 'Historial reciente',
}: PreEventPaymentLinksCardProps) {
  const [state, formAction] = useActionState(action, initialPreEventPaymentLinkFormState);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const latestLink = paymentLinks[0] ?? null;

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback('Link copiado al portapapeles.');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback('No se pudo copiar automáticamente. Copia manualmente el link.');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthFeedback state={state} />

        <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium">
            Modo de cobro
            <select
              name="payment_mode"
              defaultValue="deposit"
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="deposit">Depósito</option>
              <option value="full">Pago completo</option>
            </select>
          </label>
          <Button type="submit" className="sm:min-w-56">
            <Link2 className="size-4" />
            Crear payment link
          </Button>
        </form>

        {copyFeedback ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{copyFeedback}</div>
        ) : null}

        {latestLink ? (
          <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Último link</Badge>
              <Badge variant="outline">{latestLink.payment_mode === 'deposit' ? 'Depósito' : 'Pago completo'}</Badge>
              <Badge variant="outline">Creado: {formatDateTime(latestLink.created_at)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground break-all">{latestLink.external_url}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Total evento: {formatMoney(latestLink.total_event_amount)}</span>
              <span>Monto a cobrar: {formatMoney(latestLink.amount_to_charge)}</span>
              <span>Saldo pendiente: {formatMoney(latestLink.balance_due)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => handleCopy(latestLink.external_url)}>
                <Copy className="size-4" />
                Copiar link
              </Button>
              <Button asChild variant="secondary">
                <a href={latestLink.external_url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" />
                  Abrir link
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {paymentLinks.length > 1 ? (
          <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{historyTitle}</p>
            <div className="space-y-2">
              {paymentLinks.slice(1, 4).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <span>{item.payment_mode === 'deposit' ? 'Depósito' : 'Pago completo'} · {formatDateTime(item.created_at)}</span>
                  <a href={item.external_url} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
                    Ver link
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
