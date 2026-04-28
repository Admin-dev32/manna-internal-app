'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ManualInvoiceForm } from '@/components/finance/manual-invoice-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceInvoiceListItem } from '@/services/invoices/queries';
import type { ManualInvoiceClientOption } from '@/types/invoices';

function formatCurrency(value: number | string | null) {
  if (value === null || value === '') return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getStatusVariant(status: FinanceInvoiceListItem['status']) {
  if (status === 'paid') return 'default';
  if (status === 'partially_paid') return 'secondary';
  if (status === 'issued') return 'outline';
  if (status === 'void') return 'warning';
  return 'outline';
}

export function FinanceInvoicesList({
  invoices,
  canView,
  canManage,
  manualInvoiceClients,
}: {
  invoices: FinanceInvoiceListItem[];
  canView: boolean;
  canManage: boolean;
  manualInvoiceClients: ManualInvoiceClientOption[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceInvoiceListItem['status']>('all');

  const filteredInvoices = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
      if (!searchTerm) return true;

      return (
        invoice.invoice_number.toLowerCase().includes(searchTerm) ||
        (invoice.quote_id ?? '').toLowerCase().includes(searchTerm) ||
        (invoice.client_full_name ?? '').toLowerCase().includes(searchTerm) ||
        (invoice.client_email ?? '').toLowerCase().includes(searchTerm)
      );
    });
  }, [invoices, search, statusFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Browse quote and manual invoices from Finanzas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? <ManualInvoiceForm manualInvoiceClients={manualInvoiceClients} /> : null}
        {!canView ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No tienes permisos `finance.invoices.view` / `finance.invoices.manage` para consultar invoices.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Search
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Invoice #, cliente, email o quote id"
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="partially_paid">Partially paid</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </label>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay invoices para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{invoice.invoice_number}</Badge>
                        <Badge variant={getStatusVariant(invoice.status)}>{invoice.status}</Badge>
                        <Badge variant="secondary">{invoice.source_label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {invoice.quote_id ? `Quote #${invoice.quote_id.slice(0, 8)}` : 'Quote N/D'}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <p>Cliente: <span className="text-foreground">{invoice.client_full_name ?? 'Cliente no ligado'}</span></p>
                      <p>Total: <span className="text-foreground">{formatCurrency(invoice.total_amount)}</span></p>
                      <p>Saldo: <span className="text-foreground">{formatCurrency(invoice.balance_due)}</span></p>
                      <p>Depósito: <span className="text-foreground">{formatCurrency(invoice.deposit_amount)}</span></p>
                      <p>Emitida: <span className="text-foreground">{formatDateTime(invoice.issued_at)}</span></p>
                      <p>Vence: <span className="text-foreground">{formatDateTime(invoice.due_at)}</span></p>
                      <p>Email: <span className="text-foreground">{invoice.client_email ?? 'N/D'}</span></p>
                      <p>Event ref: <span className="text-foreground">{invoice.event_id ? `#${invoice.event_id.slice(0, 8)}` : 'N/D'}</span></p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/finanzas?invoice=${invoice.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                        View detail
                      </Link>
                      {invoice.quote_id ? (
                        <Link href={`/cotizaciones/${invoice.quote_id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                          View quote
                        </Link>
                      ) : null}
                      {invoice.pre_event_id ? (
                        <Link href={`/reservas/${invoice.pre_event_id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                          View reservation
                        </Link>
                      ) : null}
                      {invoice.event_id ? (
                        <Link href={`/eventos/${invoice.event_id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                          View event
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
