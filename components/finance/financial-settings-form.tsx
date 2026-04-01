'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { EditableExpensesList } from '@/components/finance/editable-expenses-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { calculateFinancialSummary } from '@/lib/finance/calculations';
import { saveFinancialSettingsAction } from '@/services/finance/actions';
import type { EditableFinancialExpense, FinancialSettingsExpenseRecord, FinancialSettingsRecord } from '@/types/finance';

interface FinancialSettingsFormProps {
  settings: FinancialSettingsRecord | null;
  expenses: FinancialSettingsExpenseRecord[];
  canEdit: boolean;
}

export function FinancialSettingsForm({ settings, expenses, canEdit }: FinancialSettingsFormProps) {
  const [defaultTaxReservePercentage, setDefaultTaxReservePercentage] = useState(String(settings?.default_tax_reserve_percentage ?? ''));
  const [defaultSalesCommissionPercentage, setDefaultSalesCommissionPercentage] = useState(String(settings?.default_sales_commission_percentage ?? ''));
  const [defaultExpenses, setDefaultExpenses] = useState<EditableFinancialExpense[]>(
    expenses.map((expense) => ({
      id: expense.id,
      name: expense.name,
      expense_type: expense.expense_type,
      value: expense.value,
      calculation_base: expense.calculation_base,
      note: expense.note,
      sort_order: expense.sort_order,
    })),
  );

  const preview = useMemo(
    () =>
      calculateFinancialSummary({
        grossRevenue: 100,
        taxReservePercentage: defaultTaxReservePercentage,
        salesCommissionPercentage: defaultSalesCommissionPercentage,
        expenses: defaultExpenses,
      }),
    [defaultExpenses, defaultSalesCommissionPercentage, defaultTaxReservePercentage],
  );

  return (
    <form action={saveFinancialSettingsAction} className="space-y-6">
      <input type="hidden" name="default_expenses_json" value={JSON.stringify(defaultExpenses)} />

      <Card>
        <CardHeader>
          <CardTitle>Defaults globales de finanzas</CardTitle>
          <CardDescription>
            Estos valores solo se usan como sugerencias iniciales al crear una hoja financiera nueva. No modifican registros existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tax reserve por defecto (%)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              name="default_tax_reserve_percentage"
              value={defaultTaxReservePercentage}
              disabled={!canEdit}
              onChange={(event) => setDefaultTaxReservePercentage(event.target.value)}
              placeholder="Sin valor por defecto"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Comisión vendedor por defecto (%)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              name="default_sales_commission_percentage"
              value={defaultSalesCommissionPercentage}
              disabled={!canEdit}
              onChange={(event) => setDefaultSalesCommissionPercentage(event.target.value)}
              placeholder="Sin valor por defecto"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos predefinidos opcionales</CardTitle>
          <CardDescription>Se copiarán como punto de partida editable cuando se cree una hoja por cotización.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditableExpensesList expenses={defaultExpenses} disabled={!canEdit} onChange={setDefaultExpenses} addLabel="Agregar gasto predefinido" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista previa de cálculo</CardTitle>
          <CardDescription>Ejemplo administrativo usando un revenue base de 100 para validar el comportamiento de los defaults.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <PreviewItem label="Tax reserve" value={`${preview.taxReserve.toFixed(2)} sobre 100`} />
          <PreviewItem label="Base after tax" value={preview.baseAfterTax.toFixed(2)} />
          <PreviewItem label="Comisión" value={preview.salesCommission.toFixed(2)} />
          <PreviewItem label="Extras" value={preview.totalExtraExpenses.toFixed(2)} />
          <PreviewItem label="Profit neto" value={preview.netProfit.toFixed(2)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-background/70 px-5 py-4">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 text-primary" />
          <p>{canEdit ? 'Tienes permiso para administrar defaults globales financieros.' : 'Tienes acceso de lectura. Se requiere permiso financiero de administración de defaults para editar.'}</p>
        </div>
        <Button type="submit" disabled={!canEdit}>
          Guardar defaults globales
        </Button>
      </div>
    </form>
  );
}

function PreviewItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
