import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function FinanceReportsSummaryCards({
  revenueSignal,
  outstandingBalance,
  approvedExpenses,
  contractorPaid,
  estimatedNet,
}: {
  revenueSignal: number;
  outstandingBalance: number;
  approvedExpenses: number;
  contractorPaid: number;
  estimatedNet: number;
}) {
  const cards = [
    { label: 'Revenue signal', value: revenueSignal },
    { label: 'Outstanding balance signal', value: outstandingBalance },
    { label: 'Approved expenses', value: approvedExpenses },
    { label: 'Contractor payouts paid', value: contractorPaid },
    { label: 'Estimated operating net', value: estimatedNet },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(card.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
