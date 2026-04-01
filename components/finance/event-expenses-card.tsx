import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinancialExpenseRecord } from '@/types/finance';

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

export function EventExpensesCard({ expenses }: { expenses: FinancialExpenseRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos reales vinculados</CardTitle>
        <CardDescription>Registros transaccionales de spending asociados a este evento (separados de la hoja de quote).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Este evento aún no tiene gastos reales vinculados.
          </div>
        ) : (
          expenses.slice(0, 8).map((expense) => (
            <div key={expense.id} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{expense.title}</p>
                <span className="text-xs text-muted-foreground">{expense.status}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{expense.category} · {expense.expense_date}</p>
              <p className="mt-1 font-semibold text-foreground">{formatCurrency(expense.amount)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
