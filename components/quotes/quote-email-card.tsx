'use client';

import { useActionState, useState, useTransition } from 'react';
import { Copy, Mail, Send } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCommunicationLanguageSourceLabel } from '@/services/communication/language';
import { initialQuoteEmailFormState } from '@/services/quotes/email-form-state';
import type { QuoteEmailFormState } from '@/services/quotes/email-form-state';
import { initialQuoteManualDeliveryFormState } from '@/services/quotes/manual-delivery-form-state';
import type { QuoteManualDeliveryFormState } from '@/services/quotes/manual-delivery-form-state';
import type { QuoteEmailDeliveryRecord, QuoteManualDeliveryRecord } from '@/types/quote-emails';

interface QuoteEmailPreview {
  toEmail: string;
  recipientName: string;
  subject: string;
  templateResolution: 'exact' | 'default_fallback' | 'missing';
  templateName: string | null;
  templateKey: string | null;
  requestedLanguage: 'es' | 'en';
  resolvedLanguage: 'es' | 'en' | null;
  languageSource: 'client_preference' | 'lead_language' | 'default';
  operatorMessage: string | null;
  eventDate: string;
  eventTime: string;
  eventAddress: string;
  serviceLabel: string;
  paymentLinkUrl: string | null;
  paymentLinkId: string | null;
  paymentModeLabel: string | null;
  paymentModeValue: 'deposit' | 'full';
  paymentAmountLabel: string | null;
  paymentAmountValue: number;
  paymentLinkStatus: 'existing' | 'auto_generated' | 'missing';
  activeModeLabel: string;
  activeModeAmountLabel: string;
  activeModeRationale: string;
  brandingCompanyName: string;
  brandingWebsiteUrl: string;
  zelleInstructions: string;
  zelleRecipientName: string | null;
  zelleRecipientContact: string | null;
  missing: string[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function QuoteEmailCard({
  preview,
  deliveries,
  manualDeliveries,
  action,
  followupAction,
  paymentReminderAction,
  manualDeliveryAction,
}: {
  preview: QuoteEmailPreview;
  deliveries: QuoteEmailDeliveryRecord[];
  manualDeliveries: QuoteManualDeliveryRecord[];
  action: (state: QuoteEmailFormState, formData: FormData) => Promise<QuoteEmailFormState>;
  followupAction: (state: QuoteEmailFormState, formData: FormData) => Promise<QuoteEmailFormState>;
  paymentReminderAction: (state: QuoteEmailFormState, formData: FormData) => Promise<QuoteEmailFormState>;
  manualDeliveryAction: (state: QuoteManualDeliveryFormState, formData: FormData) => Promise<QuoteManualDeliveryFormState>;
}) {
  const [state, formAction] = useActionState(action, initialQuoteEmailFormState);
  const [followupState, followupFormAction] = useActionState(followupAction, initialQuoteEmailFormState);
  const [reminderState, reminderFormAction] = useActionState(paymentReminderAction, initialQuoteEmailFormState);
  const [manualState, manualFormAction] = useActionState(manualDeliveryAction, initialQuoteManualDeliveryFormState);
  const [manualChannel, setManualChannel] = useState<'whatsapp' | 'sms' | 'manual_link'>('whatsapp');
  const [, startTransition] = useTransition();

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      const formData = new FormData();
      formData.set('channel', manualChannel);
      formData.set('payment_mode', preview.paymentModeValue);
      formData.set('payment_link_id', preview.paymentLinkId ?? '');
      formData.set('link_url', url);
      formData.set('amount_to_charge', String(preview.paymentAmountValue));
      startTransition(() => {
        manualFormAction(formData);
      });
    } catch {
      // Clipboard might be blocked by browser permissions.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Envío de cotización por email
        </CardTitle>
        <CardDescription>Revisa el contenido comercial antes de enviar. Compatible con branding, Stripe payment link y opción Zelle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthFeedback state={state} />
        <AuthFeedback state={followupState} />
        <AuthFeedback state={reminderState} />
        <AuthFeedback state={manualState} />

        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
          <p><strong>Para:</strong> {preview.recipientName} ({preview.toEmail || 'Sin email'})</p>
          <p className="mt-1"><strong>Asunto:</strong> {preview.subject}</p>
          <p className="mt-1">
            <strong>Idioma:</strong> solicitado {preview.requestedLanguage.toUpperCase()}
            {preview.resolvedLanguage ? ` · final ${preview.resolvedLanguage.toUpperCase()}` : ''}
          </p>
          <p className="mt-1"><strong>Fuente de idioma:</strong> {getCommunicationLanguageSourceLabel(preview.languageSource)}</p>
          <p className="mt-1">
            <strong>Plantilla:</strong>{' '}
            {preview.templateName
              ? `${preview.templateName} (${preview.templateKey})`
              : 'No hay plantilla activa; se usará draft base'}
          </p>
          {preview.templateResolution === 'exact' ? (
            <Badge className="mt-2" variant="success">Plantilla exacta por idioma</Badge>
          ) : preview.templateResolution === 'default_fallback' ? (
            <Badge className="mt-2" variant="warning">Fallback al idioma por defecto</Badge>
          ) : (
            <Badge className="mt-2" variant="warning">Sin plantilla activa</Badge>
          )}
          {preview.operatorMessage ? <p className="mt-2 text-xs text-amber-700">{preview.operatorMessage}</p> : null}
          <p className="mt-1"><strong>Marca:</strong> {preview.brandingCompanyName} · {preview.brandingWebsiteUrl}</p>
          <p className="mt-1"><strong>Modo de cobro activo:</strong> {preview.activeModeLabel} · {preview.activeModeAmountLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{preview.activeModeRationale}</p>
          <p className="mt-1"><strong>Evento:</strong> {preview.eventDate} · {preview.eventTime}</p>
          <p className="mt-1"><strong>Dirección:</strong> {preview.eventAddress}</p>
          <p className="mt-1"><strong>Servicio:</strong> {preview.serviceLabel}</p>
          {preview.paymentLinkUrl ? (
            <div className="mt-1 space-y-2">
              <p className="break-all">
                <strong>Payment link:</strong> {preview.paymentModeLabel} · {preview.paymentAmountLabel} · {preview.paymentLinkUrl}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={preview.paymentLinkStatus === 'auto_generated' ? 'warning' : 'secondary'}>
                  {preview.paymentLinkStatus === 'auto_generated' ? 'Auto-generado al enviar email' : 'Reutilizado de cotización'}
                </Badge>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  Canal manual
                  <select
                    value={manualChannel}
                    onChange={(event) => setManualChannel(event.target.value as 'whatsapp' | 'sms' | 'manual_link')}
                    className="h-8 rounded-xl border border-input bg-background px-2 text-xs"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="manual_link">Link manual</option>
                  </select>
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(preview.paymentLinkUrl!)}>
                  <Copy className="size-4" />
                  Copiar link de {preview.paymentModeLabel?.toLowerCase() ?? 'cobro'} para SMS/WhatsApp
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-amber-700"><strong>Payment link:</strong> No existe link para esta cotización (se enviarán instrucciones sin link).</p>
          )}
          <p className="mt-2"><strong>Zelle:</strong> {preview.zelleInstructions}</p>
          {preview.zelleRecipientName || preview.zelleRecipientContact ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {preview.zelleRecipientName ? `Receptor: ${preview.zelleRecipientName}` : ''}
              {preview.zelleRecipientContact ? `${preview.zelleRecipientName ? ' · ' : ''}Dato: ${preview.zelleRecipientContact}` : ''}
            </p>
          ) : null}
        </div>

        {preview.missing.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Faltan datos para poder enviar</p>
            {preview.missing.map((item) => (
              <div key={item} className="rounded-xl border border-amber-200 bg-white px-3 py-2">{item}</div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <form action={formAction}>
              <Button type="submit" className="w-full sm:w-auto">
                <Send className="size-4" />
                Enviar cotización (quote_delivery)
              </Button>
            </form>
            <form action={followupFormAction}>
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                <Send className="size-4" />
                Enviar seguimiento (quote_followup)
              </Button>
            </form>
            <form action={reminderFormAction}>
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                <Send className="size-4" />
                Enviar recordatorio (payment_reminder)
              </Button>
            </form>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Trazabilidad de delivery comercial</p>
          {preview.paymentLinkUrl ? (
            <p className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Último delivery útil preparado con <strong>{preview.paymentModeLabel}</strong> ({preview.paymentAmountLabel}).
            </p>
          ) : null}
          {deliveries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">Aún no hay envíos registrados para esta cotización.</p>
          ) : (
            deliveries.slice(0, 3).map((delivery) => (
              <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <span>{delivery.to_email} · {delivery.sent_at ? formatDateTime(delivery.sent_at) : 'Intento fallido'}</span>
                <Badge variant={delivery.status === 'sent' ? 'success' : 'warning'}>{delivery.status === 'sent' ? 'Enviado' : 'Fallido'}</Badge>
              </div>
            ))
          )}
          {manualDeliveries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">Aún no hay registros de canal manual (SMS/WhatsApp/link) para esta cotización.</p>
          ) : (
            manualDeliveries.slice(0, 3).map((delivery) => (
              <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <span>
                  Canal manual: {delivery.channel.toUpperCase()} · {delivery.payment_mode === 'full' ? 'Pago completo' : 'Depósito'} · {delivery.amount_to_charge ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(delivery.amount_to_charge)) : 'Sin monto'} · {formatDateTime(delivery.created_at)}
                </span>
                <Badge variant="secondary">Copiado</Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
