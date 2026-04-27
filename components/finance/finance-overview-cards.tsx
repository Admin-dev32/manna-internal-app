import { Card, CardContent } from '@/components/ui/card';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function FinanceOverviewCards({
  expectedIncome,
  knownPaidIncome,
  pendingBalance,
  projectedExpenses,
  actualApprovedExpenses,
  projectedProfit,
  knownProfit,
}: {
  expectedIncome: number;
  knownPaidIncome: number;
  pendingBalance: number;
  projectedExpenses: number;
  actualApprovedExpenses: number;
  projectedProfit: number;
  knownProfit: number;
}) {
  const cards = [
    ['Expected income', expectedIncome],
    ['Known payment signal', knownPaidIncome],
    ['Pending balance', pendingBalance],
    ['Projected expenses', projectedExpenses],
    ['Actual approved expenses', actualApprovedExpenses],
    ['Projected profit', projectedProfit],
    ['Known profit', knownProfit],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
