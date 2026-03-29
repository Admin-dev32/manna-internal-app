'use client';

import type { ReactNode } from 'react';
import { useActionState, useMemo, useState } from 'react';
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
import type { QuoteDepositType, QuoteDiscountType, QuoteRecord, QuoteStatus } from '@/types/quotes';

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

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(Math.max(value, 0) * 100) / 100;
}

function toInputValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export function QuoteForm({ action, lead, quote, submitLabel }: QuoteFormProps) {
  const [state, formAction] = useActionState(action, initialQuoteFormState);
  const initialStatus = (quote?.status ?? 'borrador') as QuoteStatus;
  const [subtotalInput, setSubtotalInput] = useState(String(quote?.subtotal ?? lead.quoted_total ?? '0'));
  const [discountType, setDiscountType] = useState<QuoteDiscountType>((quote?.discount_type ?? 'fixed') as QuoteDiscountType);
  const [discountValueInput, setDiscountValueInput] = useState(
    String(quote?.discount_value ?? (quote?.discount_amount ?? '0')),
  );
  const [depositType, setDepositType] = useState<QuoteDepositType>((quote?.deposit_type ?? 'fixed') as QuoteDepositType);
  const [depositValueInput, setDepositValueInput] = useState(
    String(quote?.deposit_value ?? (quote?.expected_deposit ?? '0')),
  );

  const calculations = useMemo(() => {
    const subtotal = roundMoney(parseNumber(subtotalInput));
    const discountValue = Math.max(parseNumber(discountValueInput), 0);
    const rawDiscountAmount = discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue;
    const discountAmount = roundMoney(Math.min(rawDiscountAmount, subtotal));
    const totalAmount = roundMoney(subtotal - discountAmount);

    const depositValue = Math.max(parseNumber(depositValueInput), 0);
    const rawDepositAmount = depositType === 'percentage' ? (totalAmount * depositValue) / 100 : depositValue;
    const expectedDeposit = roundMoney(Math.min(rawDepositAmount, totalAmount));
    const estimatedBalance = roundMoney(totalAmount - expectedDeposit);

    return {
      subtotal,
      discountAmount,
      totalAmount,
      expectedDeposit,
      estimatedBalance,
    };
  }, [depositType, depositValueInput, discountType, discountValueInput, subtotalInput]);

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
          <CardDescription>El sistema calcula automáticamente descuento, total, depósito y saldo a partir de tus entradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Estado de cotización" required>
              <SelectField name="status" defaultValue={initialStatus} options={quoteStatusOptions} />
            </Field>
            <Field label="Fecha de envío">
              <Input name="sent_at" type="datetime-local" defaultValue={formatDateTimeLocal(quote?.sent_at ?? null)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subtotal base" required>
              <Input
                name="subtotal"
                type="number"
                min="0"
                step="0.01"
                value={subtotalInput}
                onChange={(event) => setSubtotalInput(event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Promoción o beneficio aplicado">
              <Input name="promotion_note" defaultValue={quote?.promotion_note ?? lead.promotion_offered ?? ''} placeholder="Ej. upgrade de barra, 10% por pronto cierre" />
            </Field>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descuento</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Field label="Tipo de descuento">
                <select
                  name="discount_type"
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value as QuoteDiscountType)}
                  className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="fixed">Fijo ($)</option>
                  <option value="percentage">Porcentaje (%)</option>
                </select>
              </Field>
              <Field label={discountType === 'percentage' ? 'Valor de descuento (%)' : 'Valor de descuento ($)'}>
                <Input
                  name="discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValueInput}
                  onChange={(event) => setDiscountValueInput(event.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Descuento calculado">
                <Input value={toInputValue(calculations.discountAmount)} readOnly />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Total final</p>
            <p className="mt-2 text-xl font-semibold text-emerald-800">${toInputValue(calculations.totalAmount)}</p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Depósito y saldo</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <Field label="Tipo de depósito">
                <select
                  name="deposit_type"
                  value={depositType}
                  onChange={(event) => setDepositType(event.target.value as QuoteDepositType)}
                  className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="fixed">Fijo ($)</option>
                  <option value="percentage">Porcentaje (%)</option>
                </select>
              </Field>
              <Field label={depositType === 'percentage' ? 'Valor de depósito (%)' : 'Valor de depósito ($)'}>
                <Input
                  name="deposit_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositValueInput}
                  onChange={(event) => setDepositValueInput(event.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Depósito calculado">
                <Input value={toInputValue(calculations.expectedDeposit)} readOnly />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Total cotizado (calculado)">
                <Input value={toInputValue(calculations.totalAmount)} readOnly />
              </Field>
              <Field label="Saldo restante (calculado)">
                <Input value={toInputValue(calculations.estimatedBalance)} readOnly />
              </Field>
            </div>
          </div>

          <input type="hidden" name="discount_amount" value={toInputValue(calculations.discountAmount)} />
          <input type="hidden" name="total_amount" value={toInputValue(calculations.totalAmount)} />
          <input type="hidden" name="expected_deposit" value={toInputValue(calculations.expectedDeposit)} />
          <input type="hidden" name="estimated_balance" value={toInputValue(calculations.estimatedBalance)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de cálculo</CardTitle>
          <CardDescription>Feedback visual para entender cómo se forma el total final de la cotización.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-5">
          <InfoPill label="Subtotal" value={toInputValue(calculations.subtotal)} />
          <InfoPill label="Descuento" value={toInputValue(calculations.discountAmount)} />
          <InfoPill label="Total" value={toInputValue(calculations.totalAmount)} highlight />
          <InfoPill label="Depósito" value={toInputValue(calculations.expectedDeposit)} />
          <InfoPill label="Saldo" value={toInputValue(calculations.estimatedBalance)} />
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
              <p>Los cálculos comerciales de esta cotización se actualizan automáticamente al editar subtotal, descuento y depósito.</p>
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

function InfoPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-background'}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${highlight ? 'text-emerald-700' : 'text-primary'}`}>{label}</p>
      <p className={`mt-2 text-sm font-semibold ${highlight ? 'text-emerald-800' : 'text-foreground'}`}>${value}</p>
    </div>
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
