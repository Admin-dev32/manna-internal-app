'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createManualInvoiceAction } from '@/services/invoices/actions';
import type { InvoiceFormState } from '@/services/invoices/form-state';
import type { ManualInvoiceClientOption } from '@/types/invoices';

const initialState: InvoiceFormState = { status: 'idle' };

export function ManualInvoiceForm({ manualInvoiceClients }: { manualInvoiceClients: ManualInvoiceClientOption[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<InvoiceFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [clientSearch, setClientSearch] = useState('');
  const [formValues, setFormValues] = useState({
    clientId: '',
    manualCustomerName: '',
    manualCustomerEmail: '',
    manualTitle: '',
    manualDescription: '',
    subtotal: '',
    discountAmount: '',
    depositAmount: '',
    dueAt: '',
    notes: '',
  });

  function updateField<K extends keyof typeof formValues>(field: K, value: (typeof formValues)[K]) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setClientSearch('');
    setFormValues({
      clientId: '',
      manualCustomerName: '',
      manualCustomerEmail: '',
      manualTitle: '',
      manualDescription: '',
      subtotal: '',
      discountAmount: '',
      depositAmount: '',
      dueAt: '',
      notes: '',
    });
  }

  function toOptionalNumber(value: string) {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  const selectedClient = useMemo(
    () => manualInvoiceClients.find((client) => client.id === formValues.clientId) ?? null,
    [formValues.clientId, manualInvoiceClients],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = clientSearch.trim().toLowerCase();
    if (!normalizedQuery) return manualInvoiceClients.slice(0, 10);
    return manualInvoiceClients
      .filter((client) => client.searchText.includes(normalizedQuery))
      .slice(0, 10);
  }, [clientSearch, manualInvoiceClients]);

  function selectClient(client: ManualInvoiceClientOption) {
    setClientSearch(client.label);
    setFormValues((prev) => ({
      ...prev,
      clientId: client.id,
      manualCustomerName: '',
      manualCustomerEmail: '',
    }));
  }

  function clearSelectedClient() {
    setClientSearch('');
    updateField('clientId', '');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(initialState);

    startTransition(async () => {
      const result = await createManualInvoiceAction({
        clientId: formValues.clientId,
        manualCustomerName: formValues.manualCustomerName,
        manualCustomerEmail: formValues.manualCustomerEmail,
        manualTitle: formValues.manualTitle,
        manualDescription: formValues.manualDescription,
        subtotal: Number(formValues.subtotal),
        discountAmount: toOptionalNumber(formValues.discountAmount),
        depositAmount: toOptionalNumber(formValues.depositAmount),
        dueAt: formValues.dueAt,
        notes: formValues.notes,
      });

      setState(result);
      if (result.status === 'success') {
        resetForm();
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Manual invoices</p>
          <p className="text-xs text-muted-foreground">Create one-off invoices without quote linkage.</p>
        </div>
        <Button type="button" variant={isOpen ? 'outline' : 'default'} onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? 'Close form' : 'Create Manual Invoice'}
        </Button>
      </div>

      {state.status !== 'idle' ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            state.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {isOpen ? (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Select existing client (optional)
                <Input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Busca por nombre, email o teléfono"
                  disabled={isPending}
                />
              </label>
              {selectedClient ? (
                <div className="rounded-xl border border-border bg-background p-3 text-sm">
                  <p className="font-medium text-foreground">{selectedClient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.email ?? 'Sin email'} · {selectedClient.phone ?? 'Sin teléfono'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearSelectedClient} disabled={isPending}>
                      Clear selection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-border bg-background p-2">
                  {filteredClients.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No matching clients.</p>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted"
                        onClick={() => selectClient(client)}
                        disabled={isPending}
                      >
                        <p className="font-medium text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email ?? 'Sin email'} · {client.phone ?? 'Sin teléfono'}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {!formValues.clientId ? (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Customer name (manual)
                  <Input
                    value={formValues.manualCustomerName}
                    onChange={(event) => updateField('manualCustomerName', event.target.value)}
                    placeholder="Nombre del cliente manual"
                    disabled={isPending}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Customer email (optional)
                  <Input
                    type="email"
                    value={formValues.manualCustomerEmail}
                    onChange={(event) => updateField('manualCustomerEmail', event.target.value)}
                    placeholder="cliente@correo.com"
                    disabled={isPending}
                  />
                </label>
              </>
            ) : null}
            <label className="flex flex-col gap-2 text-sm font-medium">
              Due date (optional)
              <Input
                type="date"
                value={formValues.dueAt}
                onChange={(event) => updateField('dueAt', event.target.value)}
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
              Invoice title
              <Input
                required
                value={formValues.manualTitle}
                onChange={(event) => updateField('manualTitle', event.target.value)}
                placeholder="Servicios de catering corporativo"
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
              Description (optional)
              <Textarea
                rows={2}
                value={formValues.manualDescription}
                onChange={(event) => updateField('manualDescription', event.target.value)}
                placeholder="Detalle corto de los servicios incluidos"
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Subtotal
              <Input
                required
                min="0"
                step="0.01"
                type="number"
                value={formValues.subtotal}
                onChange={(event) => updateField('subtotal', event.target.value)}
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Discount amount
              <Input
                min="0"
                step="0.01"
                type="number"
                value={formValues.discountAmount}
                onChange={(event) => updateField('discountAmount', event.target.value)}
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Deposit amount
              <Input
                min="0"
                step="0.01"
                type="number"
                value={formValues.depositAmount}
                onChange={(event) => updateField('depositAmount', event.target.value)}
                disabled={isPending}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
              Notes (optional)
              <Textarea
                rows={2}
                value={formValues.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Notas internas para el invoice manual"
                disabled={isPending}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating manual invoice...' : 'Create manual invoice'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Required: invoice title + subtotal + (selected client or manual customer name). Validation final is server-side.
            </p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
