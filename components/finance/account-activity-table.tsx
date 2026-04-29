import type { AccountActivityRow } from '@/lib/finance/gl-reports';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function AccountActivityTable({ rows }: { rows: AccountActivityRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Account</th><th className="px-3 py-2">Opening</th><th className="px-3 py-2">Debits</th><th className="px-3 py-2">Credits</th><th className="px-3 py-2">Ending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountId} className="border-t border-border">
              <td className="px-3 py-2">{row.accountCode} · {row.accountName}</td>
              <td className="px-3 py-2">{formatCurrency(row.openingBalance)}</td>
              <td className="px-3 py-2">{formatCurrency(row.periodDebits)}</td>
              <td className="px-3 py-2">{formatCurrency(row.periodCredits)}</td>
              <td className="px-3 py-2">{formatCurrency(row.endingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
