import type { GeneralLedgerRow } from '@/lib/finance/gl-reports';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function GeneralLedgerTable({ rows }: { rows: GeneralLedgerRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Journal</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Debit</th><th className="px-3 py-2">Credit</th><th className="px-3 py-2">Memo/Entity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.journalEntryId}:${row.accountId}:${row.memo ?? ''}:${row.entityId ?? ''}`} className="border-t border-border">
              <td className="px-3 py-2">{row.entryDate}</td>
              <td className="px-3 py-2">{row.journalEntryId.slice(0, 8)}</td>
              <td className="px-3 py-2">{row.sourceType}:{row.sourceId}</td>
              <td className="px-3 py-2">{row.accountCode} · {row.accountName}</td>
              <td className="px-3 py-2">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
              <td className="px-3 py-2">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
              <td className="px-3 py-2">{row.memo ?? '—'}{row.entityType && row.entityId ? ` (${row.entityType}:${row.entityId})` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
