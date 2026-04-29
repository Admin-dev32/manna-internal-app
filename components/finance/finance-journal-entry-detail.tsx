import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PostJournalEntryButton } from '@/components/finance/post-journal-entry-button';
import type { JournalEntryWithLines } from '@/types/finance';

function formatCurrency(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00.000Z`));
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusVariant(status: JournalEntryWithLines['entry']['status']) {
  if (status === 'posted') return 'default';
  if (status === 'reversed') return 'warning';
  return 'secondary';
}

export function FinanceJournalEntryDetail({
  detail,
  accountsById,
  canPostJournalEntry,
}: {
  detail: JournalEntryWithLines;
  accountsById: Record<string, { code: string; name: string }>;
  canPostJournalEntry: boolean;
}) {
  const totalDebits = detail.lines.reduce((sum, line) => sum + asNumber(line.debit), 0);
  const totalCredits = detail.lines.reduce((sum, line) => sum + asNumber(line.credit), 0);
  const isBalanced = Math.round(totalDebits * 100) / 100 === Math.round(totalCredits * 100) / 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal entry detail</CardTitle>
        <CardDescription>Read-only review of journal entry header and lines.</CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(detail.entry.status)}>{detail.entry.status}</Badge>
          <Badge variant="outline">{detail.entry.source_type}</Badge>
          <Badge variant="outline">source_id: {detail.entry.source_id}</Badge>
          <Badge variant="outline">entry_date: {formatDate(detail.entry.entry_date)}</Badge>
          <Badge variant={isBalanced ? 'secondary' : 'warning'}>{isBalanced ? 'Balanced' : 'Unbalanced'}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Draft journals can be reviewed and then posted. Posting locks the entry for immutability.
        </p>
        <p className="text-sm text-muted-foreground">Posted entries are immutable; corrections are handled via reversal workflows.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-3 text-sm">
          <p className="font-medium text-foreground">Description</p>
          <p className="mt-1 text-muted-foreground">{detail.entry.description ?? 'N/A'}</p>
        </div>

        {detail.entry.status === 'draft' && canPostJournalEntry ? <PostJournalEntryButton journalEntryId={detail.entry.id} /> : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Debit</th>
                <th className="px-3 py-2">Credit</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2">Entity</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => {
                const account = accountsById[line.account_id];
                return (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{account ? `${account.code} · ${account.name}` : line.account_id}</p>
                    </td>
                    <td className="px-3 py-2">{asNumber(line.debit) > 0 ? formatCurrency(line.debit) : '—'}</td>
                    <td className="px-3 py-2">{asNumber(line.credit) > 0 ? formatCurrency(line.credit) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.memo ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.entity_type && line.entity_id ? `${line.entity_type}:${line.entity_id}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted/20 font-medium">
              <tr>
                <td className="px-3 py-2">Totals</td>
                <td className="px-3 py-2">{formatCurrency(totalDebits)}</td>
                <td className="px-3 py-2">{formatCurrency(totalCredits)}</td>
                <td className="px-3 py-2" colSpan={2}>
                  {isBalanced ? 'Balanced' : 'Unbalanced'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
