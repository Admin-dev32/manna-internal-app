'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EditableFinancialExpense } from '@/types/finance';

interface EditableExpensesListProps {
  expenses: EditableFinancialExpense[];
  disabled?: boolean;
  onChange: (expenses: EditableFinancialExpense[]) => void;
  addLabel?: string;
}

const percentageBaseLabels = {
  gross_revenue: 'Gross revenue',
  after_tax: 'After tax',
  after_tax_and_commission: 'After tax + comisión',
} as const;

export function EditableExpensesList({
  expenses,
  disabled = false,
  onChange,
  addLabel = 'Agregar gasto',
}: EditableExpensesListProps) {
  function updateExpense(index: number, nextExpense: EditableFinancialExpense) {
    onChange(expenses.map((expense, currentIndex) => (currentIndex === index ? nextExpense : expense)));
  }

  function removeExpense(index: number) {
    onChange(expenses.filter((_, currentIndex) => currentIndex !== index).map((expense, currentIndex) => ({ ...expense, sort_order: currentIndex })));
  }

  function addExpense() {
    onChange([
      ...expenses,
      {
        id: `expense-${crypto.randomUUID()}`,
        name: '',
        expense_type: 'fixed',
        value: null,
        calculation_base: null,
        note: null,
        sort_order: expenses.length,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
          No hay gastos adicionales configurados todavía.
        </div>
      ) : null}

      {expenses.map((expense, index) => (
        <div key={expense.id} className="rounded-3xl border border-border bg-background/70 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nombre</label>
              <Input
                value={expense.name}
                disabled={disabled}
                onChange={(event) => updateExpense(index, { ...expense, name: event.target.value })}
                placeholder="Ej. renta de equipo"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tipo</label>
              <select
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={expense.expense_type}
                disabled={disabled}
                onChange={(event) =>
                  updateExpense(index, {
                    ...expense,
                    expense_type: event.target.value === 'percentage' ? 'percentage' : 'fixed',
                    calculation_base: event.target.value === 'percentage' ? expense.calculation_base ?? 'gross_revenue' : null,
                  })
                }
              >
                <option value="fixed">Monto fijo</option>
                <option value="percentage">Porcentaje</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {expense.expense_type === 'percentage' ? 'Porcentaje' : 'Monto'}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={expense.value ?? ''}
                disabled={disabled}
                onChange={(event) => updateExpense(index, { ...expense, value: event.target.value })}
                placeholder={expense.expense_type === 'percentage' ? '0.00' : '0.00'}
              />
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" size="icon" disabled={disabled} onClick={() => removeExpense(index)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {expense.expense_type === 'percentage' ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Base de cálculo</label>
              <select
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={expense.calculation_base ?? 'gross_revenue'}
                disabled={disabled}
                onChange={(event) => updateExpense(index, { ...expense, calculation_base: event.target.value as EditableFinancialExpense['calculation_base'] })}
              >
                {Object.entries(percentageBaseLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota opcional</label>
            <Textarea
              className="min-h-24"
              value={expense.note ?? ''}
              disabled={disabled}
              onChange={(event) => updateExpense(index, { ...expense, note: event.target.value })}
              placeholder="Contexto interno del gasto."
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" disabled={disabled} onClick={addExpense}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
