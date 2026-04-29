import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function GLReportsSummaryCards({
  postedLineCount,
  trialBalanceDebit,
  trialBalanceCredit,
  isBalanced,
}: {
  postedLineCount: number;
  trialBalanceDebit: number;
  trialBalanceCredit: number;
  isBalanced: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Posted GL lines</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-semibold">{postedLineCount}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Trial debits</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-semibold">{formatCurrency(trialBalanceDebit)}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Trial credits</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-semibold">{formatCurrency(trialBalanceCredit)}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Balanced</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-semibold">{isBalanced ? 'Yes' : 'No'}</p></CardContent>
      </Card>
    </div>
  );
}
