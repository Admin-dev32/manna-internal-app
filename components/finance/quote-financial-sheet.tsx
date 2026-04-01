'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, LockKeyhole, Settings2 } from 'lucide-react';

import { EditableExpensesList } from '@/components/finance/editable-expenses-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { calculateFinancialSummary } from '@/lib/finance/calculations';
import { saveQuoteFinancialSheetAction } from '@/services/finance/actions';
import type { EditableFinancialExpense, QuoteFinancialSheetDraft } from '@/types/finance';

interface QuoteFinancialSheetProps {
  quoteId: string;
  draft: QuoteFinancialSheetDraft;
  canManage: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function QuoteFinancialSheet({ quoteId, draft, canManage }: QuoteFinancialSheetProps) {
  const [grossRevenue, setGrossRevenue] = useState(String(draft.sheet?.gross_revenue ?? draft.initialGrossRevenue ?? ''));
  const [taxReservePercentage, setTaxReservePercentage] = useState(String(draft.sheet?.tax_reserve_percentage ?? draft.defaults.taxReservePercentage ?? ''));
  const [salesCommissionPercentage, setSalesCommissionPercentage] = useState(
    String(draft.sheet?.sales_commission_percentage ?? draft.defaults.salesCommissionPercentage ?? ''),
  );
  const [expenses, setExpenses] = useState<EditableFinancialExpense[]>(draft.expenses);

  const summary = useMemo(
    () =>
      calculateFinancialSummary({
        grossRevenue,
        taxReservePercentage,
        salesCommissionPercentage,
        expenses,
      }),
    [expenses, grossRevenue, salesCommissionPercentage, taxReservePercentage],
  );

  return (
    <form action={saveQuoteFinancialSheetAction.bind(null, quoteId)} className="space-y-6">
      <input type="hidden" name="defaults_source_settings_id" value={draft.sheet?.defaults_source_settings_id ?? draft.defaults.settingsId ?? ''} />
      <input type="hidden" name="expenses_json" value={JSON.stringify(expenses)} />

      <section className="flex flex-col gap-4 rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-white/10 text-white">Interno financiero</Badge>
          <Badge variant="secondary">{draft.sheet ? 'Hoja persistida' : 'Pendiente de guardar'}</Badge>
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
            Base revenue: {draft.revenueBaseSource === 'persisted_sheet' ? 'valor persistido de hoja' : 'total actual de cotización'}
          </Badge>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Hoja financiera interna</h2>
          <p className="max-w-3xl text-sm text-slate-300">
            Capa administrativa separada de la vista comercial. Calcula reserva de tax, comisión, gastos y profit neto real para esta cotización.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/finanzas">
              <Settings2 className="size-4" />
              Ajustes globales
            </Link>
          </Button>
          {!canManage ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              <LockKeyhole className="size-4" />
              Solo usuarios con permiso financiero de edición de hoja pueden editar.
            </div>
          ) : null}
        </div>
        {draft.latestChange ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200">
            Último cambio financiero registrado: {draft.latestChange.change_kind} · {formatDateTime(draft.latestChange.created_at)}.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200">
            Sin cambios financieros persistidos todavía para esta cotización.
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bloque 1 — Revenue</CardTitle>
              <CardDescription>Monto base editable desde el que parte todo el cálculo interno y el net profit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Revenue base (gross revenue)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                name="gross_revenue"
                value={grossRevenue}
                disabled={!canManage}
                onChange={(event) => setGrossRevenue(event.target.value)}
                placeholder="0.00"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloque 2 — Tax reserve</CardTitle>
              <CardDescription>Porcentaje editable por registro. El monto se recalcula automáticamente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Porcentaje tax reserve</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  name="tax_reserve_percentage"
                  value={taxReservePercentage}
                  disabled={!canManage}
                  onChange={(event) => setTaxReservePercentage(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <SummaryMetric label="Monto calculado" value={formatCurrency(summary.taxReserve)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloque 3 — Comisión vendedor</CardTitle>
              <CardDescription>La comisión se calcula sobre el revenue después del tax reserve.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Porcentaje comisión</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  name="sales_commission_percentage"
                  value={salesCommissionPercentage}
                  disabled={!canManage}
                  onChange={(event) => setSalesCommissionPercentage(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <SummaryMetric label="Base visible" value={formatCurrency(summary.baseAfterTax)} />
              <SummaryMetric label="Monto calculado" value={formatCurrency(summary.salesCommission)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloque 4 — Gastos adicionales</CardTitle>
              <CardDescription>Lista dinámica editable con montos fijos o porcentuales y base de cálculo configurable.</CardDescription>
            </CardHeader>
            <CardContent>
              <EditableExpensesList expenses={expenses} disabled={!canManage} onChange={setExpenses} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5 text-primary" />
                Bloque 5 — Resumen final
              </CardTitle>
              <CardDescription>Recalcula automáticamente cada vez que cambian revenue, porcentajes o gastos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow label="Revenue base" value={formatCurrency(summary.grossRevenue)} />
              <SummaryRow label="Tax %" value={formatPercentage(summary.taxReservePercentage)} />
              <SummaryRow label="Tax amount" value={formatCurrency(summary.taxReserve)} />
              <SummaryRow label="Comisión %" value={formatPercentage(summary.salesCommissionPercentage)} />
              <SummaryRow label="Commission amount" value={formatCurrency(summary.salesCommission)} />
              <SummaryRow label="Total expenses" value={formatCurrency(summary.totalExtraExpenses)} />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Net profit</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-900">{formatCurrency(summary.netProfit)}</p>
              </div>

              {summary.expenses.length > 0 ? (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Detalle de gastos</p>
                  <div className="mt-3 space-y-3">
                    {summary.expenses.map((expense) => (
                      <div key={expense.id} className="rounded-2xl border border-border/70 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">{expense.name || 'Gasto sin nombre'}</p>
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(expense.amount)}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {expense.expenseType === 'percentage'
                            ? `Porcentaje sobre ${expense.calculationBase ?? 'gross_revenue'} · base ${formatCurrency(expense.baseAmount ?? 0)}`
                            : 'Monto fijo'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={!canManage}>
                Guardar hoja financiera
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
