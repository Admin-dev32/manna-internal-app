'use client';

import { useActionState, useMemo, useState } from 'react';
import { CheckCircle2, Send, XCircle } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  approveFinancialExpenseAction,
  rejectFinancialExpenseAction,
  submitFinancialExpenseAction,
  uploadFinancialExpenseReceiptAction,
  upsertFinancialExpenseAction,
} from '@/services/finance/actions';
import { initialFinancialExpenseActionState } from '@/services/finance/expenses-form-state';
import { matchesFinanceExpenseEventSearch } from '@/lib/finance/expense-event-search';
import type { FinanceExpenseEventSearchOption, FinancialExpenseCategoryRecord, FinancialExpenseRecord } from '@/types/finance';

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function statusLabel(status: FinancialExpenseRecord['status']) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Enviado';
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    default:
      return status;
  }
}

function getReceiptUploadedAt(expense: FinancialExpenseRecord) {
  const value = expense.receipt_metadata?.uploadedAt;
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function ExpensesModule({
  expenses,
  eventOptions,
  eventSearchOptions,
  categories,
  canView,
  canManage,
  canApprove,
}: {
  expenses: FinancialExpenseRecord[];
  eventOptions: Array<{ id: string; label: string }>;
  eventSearchOptions: FinanceExpenseEventSearchOption[];
  categories: FinancialExpenseCategoryRecord[];
  canView: boolean;
  canManage: boolean;
  canApprove: boolean;
}) {
  const [state, formAction] = useActionState(upsertFinancialExpenseAction, initialFinancialExpenseActionState);
  const [statusFilter, setStatusFilter] = useState<'all' | FinancialExpenseRecord['status']>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | FinancialExpenseRecord['expense_scope']>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [expenseScope, setExpenseScope] = useState<FinancialExpenseRecord['expense_scope']>('general');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [legacyCategoryText, setLegacyCategoryText] = useState('');

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (statusFilter !== 'all' && expense.status !== statusFilter) return false;
        if (scopeFilter !== 'all' && expense.expense_scope !== scopeFilter) return false;
        if (eventFilter !== 'all' && expense.event_id !== eventFilter) return false;
        return true;
      }),
    [eventFilter, expenses, scopeFilter, statusFilter],
  );

  const eventLabelMap = useMemo(() => Object.fromEntries(eventOptions.map((event) => [event.id, event.label])), [eventOptions]);
  const selectedSearchEvent = useMemo(
    () => eventSearchOptions.find((event) => event.event_id === selectedEventId) ?? null,
    [eventSearchOptions, selectedEventId],
  );
  const filteredEventSearchOptions = useMemo(() => {
    const source = expenseScope === 'event' ? eventSearchOptions : [];
    const result = source.filter((event) => matchesFinanceExpenseEventSearch(event.search_text, eventSearchQuery));
    return result.slice(0, 8);
  }, [eventSearchOptions, eventSearchQuery, expenseScope]);
  const categoryById = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, category])), [categories]);
  const selectedCategory = selectedCategoryId ? categoryById[selectedCategoryId] ?? null : null;

  function handleScopeChange(value: FinancialExpenseRecord['expense_scope']) {
    setExpenseScope(value);
    if (value === 'general') {
      setSelectedEventId('');
      setEventSearchQuery('');
    }
  }

  function selectEvent(event: FinanceExpenseEventSearchOption) {
    setSelectedEventId(event.event_id);
    setEventSearchQuery(event.label);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending / gastos reales</CardTitle>
        <CardDescription>
          Este bloque maneja gastos transaccionales reales. No reemplaza la hoja de quote (`quote_financial_expenses`), que sigue siendo una proyección.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AuthFeedback state={state} />

        {canManage ? (
          <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Título
                <input
                  name="title"
                  required
                  placeholder="Compra hielo evento sábado"
                  className="h-11 rounded-2xl border border-input bg-background px-4 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Categoría
                <select
                  name="category_id"
                  value={selectedCategoryId}
                  onChange={(event) => {
                    const nextCategoryId = event.target.value;
                    setSelectedCategoryId(nextCategoryId);
                    const nextCategory = nextCategoryId ? categoryById[nextCategoryId] : null;
                    if (nextCategory && !legacyCategoryText.trim()) {
                      setLegacyCategoryText(nextCategory.name);
                    }
                  }}
                  className="h-11 rounded-2xl border border-input bg-background px-4 text-sm"
                >
                  <option value="">Legacy / custom category (text)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Categoría (legacy text fallback)
                <input
                  name="category"
                  required
                  value={legacyCategoryText}
                  onChange={(event) => setLegacyCategoryText(event.target.value)}
                  placeholder="Insumos, transporte, staff..."
                  className="h-11 rounded-2xl border border-input bg-background px-4 text-sm"
                />
              </label>
              {selectedCategory ? (
                <div className="md:col-span-2 rounded-2xl border border-border bg-background p-3 text-xs text-muted-foreground">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedCategory.report_group ? <Badge variant="secondary">{selectedCategory.report_group}</Badge> : null}
                    {selectedCategory.tax_sensitive ? <Badge variant="outline">Tax sensitive</Badge> : null}
                    {selectedCategory.requires_receipt ? <Badge variant="outline">Receipt recommended</Badge> : null}
                  </div>
                  {selectedCategory.requires_receipt ? (
                    <p>This category usually requires a receipt. You can still submit now and upload receipt later.</p>
                  ) : (
                    <p>Selected controlled category will be used for reporting; legacy text is kept for compatibility.</p>
                  )}
                </div>
              ) : null}
              <label className="flex flex-col gap-2 text-sm font-medium">
                Monto
                <input name="amount" type="number" min="0" step="0.01" required className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Fecha del gasto
                <input name="expense_date" type="date" required className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Alcance
                <select
                  name="expense_scope"
                  value={expenseScope}
                  onChange={(event) => handleScopeChange(event.target.value as FinancialExpenseRecord['expense_scope'])}
                  className="h-11 rounded-2xl border border-input bg-background px-4 text-sm"
                >
                  <option value="general">General operativo</option>
                  <option value="event">Ligado a evento</option>
                </select>
              </label>
              <div className="flex flex-col gap-2 text-sm font-medium">
                <span>Link to Event</span>
                <input type="hidden" name="event_id" value={expenseScope === 'event' ? selectedEventId : ''} />
                {expenseScope === 'event' ? (
                  <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
                    <input
                      value={eventSearchQuery}
                      onChange={(event) => setEventSearchQuery(event.target.value)}
                      placeholder="Search by client, date, event type, or event ID"
                      className="h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm"
                    />
                    {selectedSearchEvent ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <p className="font-medium">Selected event</p>
                        <p>
                          {selectedSearchEvent.client_name ?? 'Cliente no ligado'} · {selectedSearchEvent.event_date ?? 'sin fecha'} ·{' '}
                          {selectedSearchEvent.event_type ?? 'Evento'} · #{selectedSearchEvent.event_id.slice(0, 8)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventId('');
                            setEventSearchQuery('');
                          }}
                          className="mt-1 text-xs underline"
                        >
                          Clear selection
                        </button>
                      </div>
                    ) : null}
                    {filteredEventSearchOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matching events found. Refine your query or select from the list below.</p>
                    ) : (
                      <div className="max-h-48 space-y-1 overflow-auto">
                        {filteredEventSearchOptions.map((event) => (
                          <button
                            key={event.event_id}
                            type="button"
                            onClick={() => selectEvent(event)}
                            className="w-full rounded-xl border border-border px-3 py-2 text-left text-xs hover:bg-muted/40"
                          >
                            {event.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <select
                      value={selectedEventId}
                      onChange={(event) => setSelectedEventId(event.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                    >
                      <option value="">Fallback: select event manually</option>
                      {eventOptions.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Select scope “Ligado a evento” to search and link an event.
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Proveedor / Payee
                <input name="vendor_name" placeholder="Proveedor o persona pagada" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Descripción
                <textarea name="description" rows={2} placeholder="Detalle corto del gasto" className="rounded-2xl border border-input bg-background px-4 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                Notas
                <textarea name="notes" rows={2} placeholder="Notas internas" className="rounded-2xl border border-input bg-background px-4 py-2 text-sm" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Receipt file name (preparación)
                <input name="receipt_file_name" placeholder="ticket-123.jpg" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Receipt bucket (preparación)
                <input name="receipt_storage_bucket" placeholder="expense-receipts" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Receipt path / referencia
                <input name="receipt_storage_path" placeholder="2026/03/31/ticket.jpg" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Referencia externa de comprobante
              <input name="receipt_external_reference" placeholder="folio caja / id externo" className="h-11 rounded-2xl border border-input bg-background px-4 text-sm" />
            </label>

            <Button type="submit">Guardar gasto (draft)</Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No tienes permisos para crear o editar gastos.
          </div>
        )}

        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Filtro estado
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">Todos</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Enviado</option>
                  <option value="approved">Aprobado</option>
                  <option value="rejected">Rechazado</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Filtro alcance
                <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">Todos</option>
                  <option value="general">General</option>
                  <option value="event">Evento</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Filtro evento
                <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="all">Todos</option>
                  {eventOptions.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay gastos para los filtros seleccionados.</div>
            ) : (
              <div className="space-y-3">
                {filteredExpenses.map((expense) => (
                  <div key={expense.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.category} · {expense.expense_scope === 'event' ? 'Evento' : 'General'} · {formatDate(expense.expense_date)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{statusLabel(expense.status)}</Badge>
                        <Badge variant="secondary">{formatCurrency(expense.amount)}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <p>Proveedor/Payee: {expense.vendor_name ?? 'Sin dato'}</p>
                      <p>Evento: {expense.event_id ? eventLabelMap[expense.event_id] ?? `#${expense.event_id.slice(0, 8)}` : 'No aplica'}</p>
                      <p className="md:col-span-2">Notas: {expense.notes ?? 'Sin notas'}</p>
                      <div className="md:col-span-2 space-y-1">
                        <p>Comprobante: {expense.receipt_file_name ?? 'No cargado'}</p>
                        <p className="text-xs">
                          Fecha de carga: {getReceiptUploadedAt(expense) ?? 'Sin registro'}
                        </p>
                        {expense.receipt_file_name && expense.receipt_signed_url ? (
                          <a href={expense.receipt_signed_url} target="_blank" rel="noreferrer noopener" className="text-xs text-primary underline">
                            Ver / descargar comprobante
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {canManage ? <ExpenseReceiptUploadForm expenseId={expense.id} /> : null}

                      {canManage && expense.status === 'draft' ? (
                        <form action={submitFinancialExpenseAction.bind(null, expense.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            <Send className="size-4" />
                            Enviar a revisión
                          </Button>
                        </form>
                      ) : null}

                      {canApprove && expense.status === 'submitted' ? (
                        <>
                          <form action={approveFinancialExpenseAction.bind(null, expense.id)}>
                            <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle2 className="size-4" />
                              Aprobar
                            </Button>
                          </form>
                          <form action={rejectFinancialExpenseAction.bind(null, expense.id)}>
                            <input type="hidden" name="rejection_reason" value="Rechazado desde panel de finanzas" />
                            <Button type="submit" size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
                              <XCircle className="size-4" />
                              Rechazar
                            </Button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No tienes permiso `finance.expenses.view` para consultar gastos transaccionales.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseReceiptUploadForm({ expenseId }: { expenseId: string }) {
  const [uploadState, uploadAction] = useActionState(uploadFinancialExpenseReceiptAction, initialFinancialExpenseActionState);

  return (
    <form action={uploadAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="expense_id" value={expenseId} />
      <input
        name="receipt_file"
        type="file"
        required
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="max-w-[260px] rounded-xl border border-input bg-background px-3 py-2 text-xs"
      />
      <Button type="submit" size="sm" variant="outline">
        Upload receipt
      </Button>
      {uploadState.status !== 'idle' ? (
        <p className={`text-xs ${uploadState.status === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{uploadState.message}</p>
      ) : null}
    </form>
  );
}
