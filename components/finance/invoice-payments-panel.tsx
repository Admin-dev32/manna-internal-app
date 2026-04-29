'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordManualInvoicePaymentAction } from '@/services/invoices/actions';
import type { InvoicePaymentSummary } from '@/lib/finance/invoice-payments';
import { INVOICE_PAYMENT_METHODS, type InvoicePaymentRecord } from '@/types/invoices';

interface DepositAccountOption {
  id: string;
  code: string;
  name: string;
}

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00.000Z`));
}

export function InvoicePaymentsPanel({
  invoiceId,
  payments,
  summary,
  canManagePayments,
  depositAccounts,
}: {
  invoiceId: string;
  payments: InvoicePaymentRecord[];
  summary: InvoicePaymentSummary;
  canManagePayments: boolean;
  depositAccounts: DepositAccountOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<(typeof INVOICE_PAYMENT_METHODS)[number]>('other');
  const [reference, setReference] = useState('');
  const [feeAmount, setFeeAmount] = useState('0');
  const [depositedToAccountId, setDepositedToAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  function resetForm() {
    setAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('other');
    setReference('');
    setFeeAmount('0');
    setDepositedToAccountId('');
    setNotes('');
  }

  function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'idle' });

    startTransition(async () => {
      const response = await recordManualInvoicePaymentAction(invoiceId, {
        amount: Number(amount),
        paymentDate,
        paymentMethod,
        reference: reference.trim() || null,
        feeAmount: feeAmount.trim() ? Number(feeAmount) : 0,
        depositedToAccountId: depositedToAccountId.trim() || null,
        notes: notes.trim() || null,
      });

      setState(response);
      if (response.status === 'success') {
        resetForm();
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Invoice Payments</p>
        <p className="text-sm text-muted-foreground">
          Payments recorded here are canonical payment records, but invoice balance/status sync is deferred to a later phase.
        </p>
        <p className="text-sm text-muted-foreground">Payment links are collection channels and are not counted as payments.</p>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total paid (succeeded)" value={formatCurrency(summary.totalPaidSucceeded)} />
        <Metric label="Total fees" value={formatCurrency(summary.totalFees)} />
        <Metric label="Total net" value={formatCurrency(summary.totalNet)} />
        <Metric label="Payment count" value={String(summary.paymentCount)} />
        <Metric label="Latest payment" value={summary.latestPaymentDate ? formatDate(summary.latestPaymentDate) : 'N/D'} />
      </div>

      {canManagePayments ? (
        <form className="space-y-3 rounded-xl border border-border bg-background p-3" onSubmit={submitManualPayment}>
          <p className="text-sm font-medium text-foreground">Record Manual Payment</p>
          <p className="text-xs text-muted-foreground">This does not automatically update invoice balance/status yet.</p>

          {state.status !== 'idle' ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Amount
              <Input type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isPending} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Payment Date
              <Input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} disabled={isPending} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Payment Method
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as (typeof INVOICE_PAYMENT_METHODS)[number])}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                disabled={isPending}
              >
                {INVOICE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Fee Amount
              <Input type="number" min="0" step="0.01" value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} disabled={isPending} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Reference
              <Input value={reference} onChange={(event) => setReference(event.target.value)} disabled={isPending} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium lg:col-span-2">
              Deposited To Account (optional)
              <select
                value={depositedToAccountId}
                onChange={(event) => setDepositedToAccountId(event.target.value)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                disabled={isPending}
              >
                <option value="">No account selected</option>
                {depositAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium lg:col-span-4">
              Notes
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isPending} />
            </label>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Recording payment...' : 'Record Payment'}
          </Button>
        </form>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          You can view canonical payment records, but recording manual payments requires finance manage permissions.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Payment Records</p>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">No invoice payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-foreground">{payment.status}</span>
                  <span className="text-xs text-muted-foreground">{payment.payment_method}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Amount: <span className="text-foreground">{formatCurrency(payment.amount)}</span> · Fee:{' '}
                  <span className="text-foreground">{formatCurrency(payment.fee_amount)}</span> · Net:{' '}
                  <span className="text-foreground">{formatCurrency(payment.net_amount)}</span>
                </p>
                {payment.reference ? (
                  <p className="text-muted-foreground">
                    Reference: <span className="text-foreground">{payment.reference}</span>
                  </p>
                ) : null}
                {payment.provider || payment.provider_payment_id ? (
                  <p className="text-muted-foreground">
                    Provider: <span className="text-foreground">{payment.provider ?? 'N/D'}</span> · Payment ID:{' '}
                    <span className="text-foreground">{payment.provider_payment_id ?? 'N/D'}</span>
                  </p>
                ) : null}
                {payment.notes ? (
                  <p className="text-muted-foreground">
                    Notes: <span className="text-foreground">{payment.notes}</span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
