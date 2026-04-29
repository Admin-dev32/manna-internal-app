import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BasicProfitLoss } from '@/lib/finance/gl-reports';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function GLProfitLossPanel({ profitLoss }: { profitLoss: BasicProfitLoss }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic P&L (GL posted only)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>Income: <span className="font-medium">{formatCurrency(profitLoss.income)}</span></p>
        <p>COGS: <span className="font-medium">{formatCurrency(profitLoss.costOfGoodsSold)}</span></p>
        <p>Expense: <span className="font-medium">{formatCurrency(profitLoss.expense)}</span></p>
        <p>Other Income: <span className="font-medium">{formatCurrency(profitLoss.otherIncome)}</span></p>
        <p>Other Expense: <span className="font-medium">{formatCurrency(profitLoss.otherExpense)}</span></p>
        <p className="pt-2 text-base">Estimated Net Income: <span className="font-semibold">{formatCurrency(profitLoss.estimatedNetIncome)}</span></p>
      </CardContent>
    </Card>
  );
}
