'use client';

import type { ReactNode } from 'react';
import { useActionState, useMemo } from 'react';
import { CircleAlert, ReceiptText } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { QuoteStatusBadge } from '@/components/quotes/quote-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { quoteStatusOptions } from '@/config/quotes';
import { initialQuoteFormState } from '@/services/quotes/form-state';
import type { QuoteFormState } from '@/services/quotes/form-state';
import type { LeadRecord } from '@/types/leads';
import type { QuoteRecord, QuoteStatus } from '@/types/quotes';

interface QuoteFormProps {
  action: (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  lead: LeadRecord;
  quote?: QuoteRecord | null;
  submitLabel: string;
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function QuoteForm({ action, lead, quote, submitLabel }: QuoteFormProps) {
  const [state, formAction] = useActionState(action, initialQuoteFormState);
  const initialStatus = (quote?.status ?? 'borrador') as QuoteStatus;
  const estimatedBalance = useMemo(() => {
    const total = Number(quote?.total_amount ?? 0);
    const deposit = Number(quote?.expected_deposit ?? 0);
    return total && Number.isFinite(total) ? Math.max(total - deposit, 0).toFixed(2) : '';
  }, [quote?.expected_deposit, quote?.total_amount]);

  return (
    <form action={formAction} className="space-y-6">
      <AuthFeedback state={state} />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Cotización ligada al lead</p>
            <p className="text-sm text-muted-foreground">
              Registra una propuesta comercial real para {lead.full_name} sin salir del flujo operativo del lead.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Lead: {lead.full_name}</Badge>
            <QuoteStatusBadge status={initialStatus} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen comercial</CardTitle>
          <CardDescription>Primera versión útil para registrar montos, estado y seguimiento básico de la propuesta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Estado de cotización" required>
            <SelectField name="status" defaultValue={initialStatus} options={quoteStatusOptions} />
          </Field>
          <Field label="Fecha de envío">
            <Input name="sent_at" type="datetime-local" defaultValue={formatDateTimeLocal(quote?.sent_at ?? null)} />
          </Field>
          <Field label="Subtotal">
            <Input name="subtotal" type="number" min="0" step="0.01" defaultValue={quote?.subtotal?.toString() ?? ''} placeholder="0.00" />
          </Field>
          <Field label="Descuento">
            <Input name="discount_amount" type="number" min="0" step="0.01" defaultValue={quote?.discount_amount?.toString() ?? ''} placeholder="0.00" />
          </Field>
          <Field label="Promoción o beneficio aplicado">
            <Input name="promotion_note" defaultValue={quote?.promotion_note ?? lead.promotion_offered ?? ''} placeholder="Ej. upgrade de barra, 10% por pronto cierre" />
          </Field>
          <Field label="Total cotizado" required>
            <Input name="total_amount" type="number" min="0" step="0.01" defaultValue={quote?.total_amount?.toString() ?? lead.quoted_total?.toString() ?? ''} placeholder="0.00" required />
          </Field>
          <Field label="Depósito esperado">
            <Input name="expected_deposit" type="number" min="0" step="0.01" defaultValue={quote?.expected_deposit?.toString() ?? ''} placeholder="0.00" />
          </Field>
          <Field label="Saldo estimado">
            <Input name="estimated_balance" type="number" min="0" step="0.01" defaultValue={quote?.estimated_balance?.toString() ?? estimatedBalance} placeholder="Se calcula o puedes ajustarlo" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observaciones internas</CardTitle>
          <CardDescription>Usa este bloque para condiciones comerciales, notas de envío y contexto del cierre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            name="notes"
            defaultValue={quote?.notes ?? ''}
            placeholder="Condiciones, comentarios, objeciones, notas de seguimiento o resumen de lo enviado al prospecto."
          />
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-4 text-primary" />
              <p>
                Esta versión todavía no genera PDF ni plantillas. La cotización queda registrada como base comercial real, conectada al lead y lista para evolucionar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="lg">
          <ReceiptText className="size-4" />
          {submitLabel}
        </Button>
        <Button type="reset" variant="outline" size="lg">
          Restablecer campos
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      <span>
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SelectField({ name, defaultValue, options }: { name: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
