import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FinanceInvoiceAgingSummary } from '@/services/invoices/aging';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value));
}

export function InvoiceFollowUpList({ summary }: { summary: FinanceInvoiceAgingSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices needing follow-up</CardTitle>
        <CardDescription>Overdue first, then due soon (next 7 days).</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.followUpInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No overdue or due-soon invoices detected.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.followUpInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${invoice.urgency === 'overdue' ? 'border-rose-200 text-rose-700' : 'border-amber-200 text-amber-700'}`}>
                    {invoice.urgency === 'overdue' ? 'overdue' : 'due soon'}
                  </span>
                  <span className="font-medium text-foreground">{invoice.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">{invoice.status}</span>
                </div>
                <p className="text-muted-foreground">Client: <span className="text-foreground">{invoice.client_full_name ?? 'Cliente no ligado'}</span></p>
                <p className="text-muted-foreground">Balance: <span className="text-foreground">{formatMoney(invoice.balance_due)}</span></p>
                <p className="text-muted-foreground">Due: <span className="text-foreground">{formatDate(invoice.due_at)}</span></p>
                <Link href={`/finanzas/invoices?invoice=${invoice.id}`} className="text-primary underline-offset-4 hover:underline">
                  View detail
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
