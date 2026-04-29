'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { deleteDraftInvoiceAction, updateManualInvoiceAction, voidInvoiceAction } from '@/services/invoices/actions';
import type { InvoiceFormState } from '@/services/invoices/form-state';
import type { InvoiceRecord } from '@/types/invoices';

const initialState: InvoiceFormState = { status: 'idle' };

function toOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function InvoiceActionsPanel({ invoice, canManageInvoices }: { invoice: InvoiceRecord; canManageInvoices: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editState, setEditState] = useState<InvoiceFormState>(initialState);
  const [voidState, setVoidState] = useState<InvoiceFormState>(initialState);
  const [deleteState, setDeleteState] = useState<InvoiceFormState>(initialState);
  const [showEdit, setShowEdit] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [formValues, setFormValues] = useState({
    clientId: invoice.client_id ?? '',
    manualCustomerName: invoice.manual_customer_name ?? '',
    manualCustomerEmail: invoice.manual_customer_email ?? '',
    manualTitle: invoice.manual_title ?? '',
    manualDescription: invoice.manual_description ?? '',
    subtotal: String(invoice.subtotal ?? ''),
    discountAmount: String(invoice.discount_amount ?? ''),
    depositAmount: String(invoice.deposit_amount ?? ''),
    dueAt: invoice.due_at ? new Date(invoice.due_at).toISOString().slice(0, 10) : '',
    notes: invoice.notes ?? '',
  });

  const isManual = invoice.source_type === 'manual';
  const isDraft = invoice.status === 'draft';
  const canEdit = canManageInvoices && isManual && isDraft;
  const canVoid = canManageInvoices && isManual && invoice.status !== 'void';
  const canDeleteDraft = canManageInvoices && isManual && isDraft;

  const contextualMessages = useMemo(() => {
    if (!canManageInvoices) return ['You need finance.invoices.manage to run invoice actions.'];

    const messages: string[] = [
      'Edit is only available for manual draft invoices.',
      'Delete is only available for unused manual draft invoices.',
    ];

    if (invoice.source_type !== 'manual') {
      messages.push('Quote-based invoices are not edited directly.');
    }

    if (invoice.status === 'issued' && invoice.source_type === 'manual') {
      messages.push('This invoice is issued. Direct editing is locked in this phase. Use Void Invoice if you need to cancel it, or create a corrected invoice.');
      messages.push('Issued invoices are locked from direct editing in this phase.');
    }

    if (invoice.status === 'paid' || invoice.status === 'partially_paid') {
      messages.push('Paid/partially paid invoices cannot be edited directly.');
    }

    if (invoice.status === 'void') {
      messages.push('Void invoices are preserved for audit history.');
    }

    return messages;
  }, [canManageInvoices, invoice.source_type, invoice.status]);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Invoice Actions</h3>

      {canManageInvoices ? (
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Action policy</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {contextualMessages.map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{contextualMessages[0]}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canEdit ? <Button type="button" variant="outline" onClick={() => setShowEdit((current) => !current)}>Edit Draft</Button> : null}
        {canVoid ? <Button type="button" variant="outline" onClick={() => setShowVoid((current) => !current)}>Void Invoice</Button> : null}
        {canDeleteDraft ? <Button type="button" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setShowDelete((current) => !current)}>Delete Draft</Button> : null}
      </div>

      {showEdit && canEdit ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setEditState(initialState);
            startTransition(async () => {
              const result = await updateManualInvoiceAction(invoice.id, {
                clientId: formValues.clientId || null,
                manualCustomerName: formValues.clientId ? null : formValues.manualCustomerName,
                manualCustomerEmail: formValues.clientId ? null : formValues.manualCustomerEmail,
                manualTitle: formValues.manualTitle,
                manualDescription: formValues.manualDescription,
                subtotal: Number(formValues.subtotal),
                discountAmount: toOptionalNumber(formValues.discountAmount),
                depositAmount: toOptionalNumber(formValues.depositAmount),
                dueAt: formValues.dueAt,
                notes: formValues.notes,
              });
              setEditState(result);
              if (result.status === 'success') router.refresh();
            });
          }}
        >
          <p className="text-sm font-medium text-foreground">Edit manual draft invoice</p>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">Client ID (optional)
              <Input value={formValues.clientId} onChange={(event) => setFormValues((prev) => ({ ...prev, clientId: event.target.value }))} disabled={isPending} />
            </label>
            {!formValues.clientId ? (
              <>
                <label className="text-sm">Manual customer name
                  <Input value={formValues.manualCustomerName} onChange={(event) => setFormValues((prev) => ({ ...prev, manualCustomerName: event.target.value }))} disabled={isPending} />
                </label>
                <label className="text-sm">Manual customer email
                  <Input type="email" value={formValues.manualCustomerEmail} onChange={(event) => setFormValues((prev) => ({ ...prev, manualCustomerEmail: event.target.value }))} disabled={isPending} />
                </label>
              </>
            ) : null}
            <label className="text-sm md:col-span-2">Invoice title
              <Input required value={formValues.manualTitle} onChange={(event) => setFormValues((prev) => ({ ...prev, manualTitle: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm md:col-span-2">Description
              <Textarea rows={2} value={formValues.manualDescription} onChange={(event) => setFormValues((prev) => ({ ...prev, manualDescription: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm">Subtotal
              <Input required type="number" step="0.01" value={formValues.subtotal} onChange={(event) => setFormValues((prev) => ({ ...prev, subtotal: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm">Discount
              <Input type="number" step="0.01" value={formValues.discountAmount} onChange={(event) => setFormValues((prev) => ({ ...prev, discountAmount: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm">Deposit
              <Input type="number" step="0.01" value={formValues.depositAmount} onChange={(event) => setFormValues((prev) => ({ ...prev, depositAmount: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm">Due date
              <Input type="date" value={formValues.dueAt} onChange={(event) => setFormValues((prev) => ({ ...prev, dueAt: event.target.value }))} disabled={isPending} />
            </label>
            <label className="text-sm md:col-span-2">Notes
              <Textarea rows={2} value={formValues.notes} onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))} disabled={isPending} />
            </label>
          </div>
          {editState.status !== 'idle' ? <p className="text-sm text-muted-foreground">{editState.message}</p> : null}
          <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save draft changes'}</Button>
        </form>
      ) : null}

      {showVoid && canVoid ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-background p-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setVoidState(initialState);
            if (!voidReason.trim()) {
              setVoidState({ status: 'error', message: 'Reason is required to void an invoice.' });
              return;
            }
            startTransition(async () => {
              const result = await voidInvoiceAction(invoice.id, voidReason);
              setVoidState(result);
              if (result.status === 'success') router.refresh();
            });
          }}
        >
          <p className="text-sm text-amber-700">Voiding preserves the invoice record. This does not delete payments, emails, or ledger history.</p>
          <label className="text-sm">Void reason
            <Textarea required rows={2} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} disabled={isPending} />
          </label>
          {voidState.status !== 'idle' ? <p className="text-sm text-muted-foreground">{voidState.message}</p> : null}
          <Button type="submit" variant="outline" disabled={isPending}>Confirm void</Button>
        </form>
      ) : null}

      {showDelete && canDeleteDraft ? (
        <form
          className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setDeleteState(initialState);
            if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
              setDeleteState({ status: 'error', message: 'Type DELETE to confirm draft deletion.' });
              return;
            }
            startTransition(async () => {
              const result = await deleteDraftInvoiceAction(invoice.id);
              setDeleteState(result);
              if (result.status === 'success') router.push('/finanzas/invoices');
            });
          }}
        >
          <p className="text-sm text-rose-700">Delete is only for unused manual draft invoices. If this invoice has payments, email history, payment links, or journal references, the backend will block deletion.</p>
          <label className="text-sm">Type DELETE to confirm
            <Input value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} disabled={isPending} />
          </label>
          {deleteState.status !== 'idle' ? <p className="text-sm text-muted-foreground">{deleteState.message}</p> : null}
          <Button type="submit" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100" disabled={isPending}>Delete draft invoice</Button>
        </form>
      ) : null}
    </section>
  );
}
