'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendInvoiceEmailAction } from '@/services/invoices/actions';
import type { FinanceInvoiceDetail } from '@/services/invoices/queries';
import type { InvoiceEmailDeliveryRecord, InvoiceEmailPurpose } from '@/types/invoices';

function formatDateTime(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getStatusClasses(status: InvoiceEmailDeliveryRecord['status']) {
  if (status === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function InvoiceEmailPanel({
  detail,
  deliveries,
  canManageInvoices,
}: {
  detail: FinanceInvoiceDetail;
  deliveries: InvoiceEmailDeliveryRecord[];
  canManageInvoices: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [purpose, setPurpose] = useState<InvoiceEmailPurpose>('invoice_delivery');
  const [recipientOverride, setRecipientOverride] = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  const recipientAvailable = Boolean(detail.client?.email?.trim() || detail.invoice.manual_customer_email?.trim());
  const latestDelivery = deliveries[0] ?? null;

  const warningMessage = useMemo(() => {
    if (recipientOverride.trim()) return null;
    if (recipientAvailable) return null;
    return 'No recipient available from client.email/manual_customer_email. Provide Recipient override to send.';
  }, [recipientAvailable, recipientOverride]);

  function submitSendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'idle' });

    startTransition(async () => {
      const response = await sendInvoiceEmailAction(detail.invoice.id, {
        purpose,
        recipientOverride: recipientOverride.trim() || null,
        subjectOverride: subjectOverride.trim() || null,
      });

      setState(response);
      if (response.status === 'success') {
        setRecipientOverride('');
        setSubjectOverride('');
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Email Invoice</p>
        <p className="text-sm text-muted-foreground">Sending this email does not mark the invoice as paid.</p>
        <p className="text-sm text-muted-foreground">Payment links are collection channels and do not confirm payment.</p>
      </div>

      {latestDelivery ? (
        <div className={`rounded-xl border px-3 py-2 text-sm ${getStatusClasses(latestDelivery.status)}`}>
          Last attempt: <strong>{latestDelivery.status.toUpperCase()}</strong> · {latestDelivery.purpose} · {formatDateTime(latestDelivery.sent_at ?? latestDelivery.created_at)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          No email delivery attempts for this invoice yet.
        </div>
      )}

      {canManageInvoices ? (
        <form className="space-y-3" onSubmit={submitSendEmail}>
          {state.status !== 'idle' ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {state.message}
            </div>
          ) : null}

          {warningMessage ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warningMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Purpose
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as InvoiceEmailPurpose)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                disabled={isPending}
              >
                <option value="invoice_delivery">invoice_delivery</option>
                <option value="invoice_reminder">invoice_reminder</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
              Recipient override (optional)
              <Input
                type="email"
                value={recipientOverride}
                onChange={(event) => setRecipientOverride(event.target.value)}
                placeholder="cliente@correo.com"
                disabled={isPending}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-3">
              Subject override (optional)
              <Input
                value={subjectOverride}
                onChange={(event) => setSubjectOverride(event.target.value)}
                placeholder={`Invoice ${detail.invoice.invoice_number}`}
                disabled={isPending}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending email...' : 'Send Email'}
            </Button>
            <p className="text-xs text-muted-foreground">Resend uses the same send action and creates a new delivery log entry.</p>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          You can view history, but sending emails requires permission <code>finance.invoices.manage</code>.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Delivery History</p>
        {deliveries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">No delivery records yet.</p>
        ) : (
          <div className="space-y-2">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${delivery.status === 'sent' ? 'border-emerald-200 text-emerald-700' : 'border-rose-200 text-rose-700'}`}>
                    {delivery.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{delivery.purpose}</span>
                </div>
                <p className="mt-1 text-muted-foreground">To: <span className="text-foreground">{delivery.sent_to}</span></p>
                <p className="text-muted-foreground">Subject: <span className="text-foreground">{delivery.subject}</span></p>
                <p className="text-muted-foreground">
                  Date: <span className="text-foreground">{formatDateTime(delivery.sent_at ?? delivery.created_at)}</span>
                  {delivery.provider ? <> · Provider: <span className="text-foreground">{delivery.provider}</span></> : null}
                </p>
                {delivery.error_message ? <p className="mt-1 text-rose-700">Error: {delivery.error_message}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
