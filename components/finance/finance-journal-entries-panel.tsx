import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { JournalEntryRecord, JournalEntryStatus, JournalEntryWithLines } from '@/types/finance';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00.000Z`));
}

function statusVariant(status: JournalEntryStatus) {
  if (status === 'posted') return 'default';
  if (status === 'reversed') return 'warning';
  return 'secondary';
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function FinanceJournalEntriesPanel({
  entries,
  selectedJournalId,
  selectedStatus,
  selectedDetail,
}: {
  entries: JournalEntryRecord[];
  selectedJournalId: string | null;
  selectedStatus: JournalEntryStatus | 'all';
  selectedDetail: JournalEntryWithLines | null;
}) {
  const statusFilters: Array<{ value: JournalEntryStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'posted', label: 'Posted' },
    { value: 'reversed', label: 'Reversed' },
  ];

  const selectedTotals = selectedDetail
    ? {
        debits: selectedDetail.lines.reduce((sum, line) => sum + asNumber(line.debit), 0),
        credits: selectedDetail.lines.reduce((sum, line) => sum + asNumber(line.credit), 0),
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal Drafts / General Ledger Preview</CardTitle>
        <CardDescription>Read-only list of journal entries created in finance workflow phases.</CardDescription>
        <p className="text-sm text-muted-foreground">
          Draft journals are review records. Posting a draft moves it into posted GL activity.
        </p>
        <p className="text-sm text-muted-foreground">Posted entries are immutable; corrections are handled via reversals in separate workflows.</p>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const isActive = selectedStatus === filter.value;
            return (
              <Link
                key={filter.value}
                href={filter.value === 'all' ? '/finanzas/accounting' : `/finanzas/accounting?journalStatus=${filter.value}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'}`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No journals found for the selected status. Try another status filter.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const isSelected = selectedJournalId === entry.id;
              const totalsLabel = isSelected && selectedTotals
                ? `${formatCurrency(selectedTotals.debits)} / ${formatCurrency(selectedTotals.credits)}`
                : 'Open detail to calculate';
              return (
                <Link
                  key={entry.id}
                  href={`/finanzas/accounting?journal=${entry.id}${selectedStatus === 'all' ? '' : `&journalStatus=${selectedStatus}`}`}
                  className={`block rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/30'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                    <Badge variant="outline">{entry.source_type}</Badge>
                    <Badge variant="outline">source_id: {entry.source_id}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{entry.description ?? 'No description'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Debits/Credits: {totalsLabel}</p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
