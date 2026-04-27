import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord } from '@/types/events';
import type { InvoiceRecord } from '@/types/invoices';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value)) : 'N/D';
}

export function InvoiceLikeSummary({
  client,
  quote,
  invoice,
  linkedEvent,
}: {
  client: ClientRecord;
  quote: QuoteRecord;
  invoice: InvoiceRecord | null;
  linkedEvent: EventRecord | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice-Like Summary</CardTitle>
        <CardDescription>Consolidado de referencias comerciales y operativas sin duplicar módulos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Quote #{quote.id.slice(0, 8)}</Badge>
          {invoice ? <Badge variant="outline">Invoice #{invoice.invoice_number}</Badge> : <Badge variant="outline">Sin invoice</Badge>}
          {invoice ? <Badge variant="secondary">{invoice.status}</Badge> : null}
        </div>

        <Row label="Cliente" value={client.full_name} />
        <Row label="Quote status" value={quote.status} />
        <Row label="Invoice status" value={invoice?.status ?? 'N/D'} />
        <Row label="Invoice issued" value={formatDate(invoice?.issued_at ?? null)} />
        <Row label="Event reference" value={linkedEvent ? `#${linkedEvent.id.slice(0, 8)}` : 'Sin evento creado'} />
        <Row label="Event date" value={linkedEvent ? formatDate(linkedEvent.event_date) : 'N/D'} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
