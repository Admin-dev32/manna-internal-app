import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function OperatingPLPanel({
  revenueSignal,
  approvedExpenses,
  contractorPaid,
  estimatedNet,
}: {
  revenueSignal: number;
  approvedExpenses: number;
  contractorPaid: number;
  estimatedNet: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating P&amp;L (est.)</CardTitle>
        <CardDescription>Operational estimate only. Tax-prep support, not final filing. Not ledger-confirmed cash accounting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Revenue signal: <strong>{formatCurrency(revenueSignal)}</strong></p>
        <p>Approved expenses: <strong>{formatCurrency(approvedExpenses)}</strong></p>
        <p>Contractor payouts paid: <strong>{formatCurrency(contractorPaid)}</strong></p>
        <p className="border-t border-border pt-2">Estimated operating net: <strong>{formatCurrency(estimatedNet)}</strong></p>
      </CardContent>
    </Card>
  );
}
