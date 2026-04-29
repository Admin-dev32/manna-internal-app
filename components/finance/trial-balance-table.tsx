import type { TrialBalanceRow } from '@/lib/finance/gl-reports';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function TrialBalanceTable({ rows }: { rows: TrialBalanceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Debit</th><th className="px-3 py-2">Credit</th><th className="px-3 py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountId} className="border-t border-border">
              <td className="px-3 py-2">{row.accountCode} · {row.accountName}</td>
              <td className="px-3 py-2">{row.accountType}</td>
              <td className="px-3 py-2">{formatCurrency(row.totalDebit)}</td>
              <td className="px-3 py-2">{formatCurrency(row.totalCredit)}</td>
              <td className="px-3 py-2">{formatCurrency(row.displayBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
