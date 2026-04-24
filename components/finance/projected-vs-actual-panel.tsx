import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function ProjectedVsActualPanel({
  projectedExpenses,
  actualApprovedExpenses,
  projectedProfit,
  knownProfit,
}: {
  projectedExpenses: number;
  actualApprovedExpenses: number;
  projectedProfit: number;
  knownProfit: number;
}) {
  const expenseVariance = actualApprovedExpenses - projectedExpenses;
  const profitVariance = knownProfit - projectedProfit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projected vs Actual</CardTitle>
        <CardDescription>
          Comparativo read-only: projected = valores planificados de quote; actual = gastos aprobados/registrados y señales de pago actualmente
          disponibles.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Item label="Projected expenses" value={formatMoney(projectedExpenses)} />
        <Item label="Actual approved expenses" value={formatMoney(actualApprovedExpenses)} />
        <Item label="Expense variance" value={formatMoney(expenseVariance)} />
        <Item label="Projected profit" value={formatMoney(projectedProfit)} />
        <Item label="Known profit" value={formatMoney(knownProfit)} />
        <Item label="Profit variance" value={formatMoney(profitVariance)} />
      </CardContent>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-primary">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
