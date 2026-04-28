export type InvoiceAgingBucketKey = 'current' | '1_30' | '31_60' | '61_90' | '90_plus' | 'unknown';

export interface InvoiceAgingInput {
  id: string;
  invoice_number: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  balance_due: number | string | null;
  due_at: string | null;
  client_full_name: string | null;
}

export interface InvoiceAgingBucket {
  count: number;
  balance: number;
}

export interface InvoiceFollowUpItem {
  id: string;
  invoice_number: string;
  client_full_name: string | null;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  balance_due: number;
  due_at: string | null;
  urgency: 'overdue' | 'due_soon';
  days_delta: number;
}

export interface FinanceInvoiceAgingSummary {
  totalInvoices: number;
  totalOutstandingBalance: number;
  totalOverdueBalance: number;
  dueSoonBalance: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  overdueCount: number;
  agingBuckets: Record<InvoiceAgingBucketKey, InvoiceAgingBucket>;
  followUpInvoices: InvoiceFollowUpItem[];
}

function toMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function createBuckets(): Record<InvoiceAgingBucketKey, InvoiceAgingBucket> {
  return {
    current: { count: 0, balance: 0 },
    '1_30': { count: 0, balance: 0 },
    '31_60': { count: 0, balance: 0 },
    '61_90': { count: 0, balance: 0 },
    '90_plus': { count: 0, balance: 0 },
    unknown: { count: 0, balance: 0 },
  };
}

export function computeFinanceInvoiceAgingSummary(inputs: InvoiceAgingInput[], now = new Date()): FinanceInvoiceAgingSummary {
  const today = startOfDay(now);
  const dueSoonLimit = new Date(today);
  dueSoonLimit.setDate(today.getDate() + 7);

  const summary: FinanceInvoiceAgingSummary = {
    totalInvoices: inputs.length,
    totalOutstandingBalance: 0,
    totalOverdueBalance: 0,
    dueSoonBalance: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    agingBuckets: createBuckets(),
    followUpInvoices: [],
  };

  for (const invoice of inputs) {
    const balanceDue = toMoney(invoice.balance_due);
    const dueDate = parseDueDate(invoice.due_at);
    const isClosed = invoice.status === 'paid' || invoice.status === 'void';
    const isOutstanding = !isClosed && balanceDue > 0;

    if (invoice.status === 'paid') summary.paidCount += 1;
    if (invoice.status === 'partially_paid') summary.partialCount += 1;
    if (invoice.status === 'draft' || invoice.status === 'issued') summary.pendingCount += 1;

    if (!isOutstanding) {
      continue;
    }

    summary.totalOutstandingBalance += balanceDue;

    if (!dueDate) {
      summary.agingBuckets.unknown.count += 1;
      summary.agingBuckets.unknown.balance += balanceDue;
      continue;
    }

    const msDiff = today.getTime() - dueDate.getTime();
    const daysPastDue = Math.floor(msDiff / 86_400_000);
    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / 86_400_000);

    if (dueDate < today) {
      summary.overdueCount += 1;
      summary.totalOverdueBalance += balanceDue;
      summary.followUpInvoices.push({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_full_name: invoice.client_full_name,
        status: invoice.status,
        balance_due: balanceDue,
        due_at: invoice.due_at,
        urgency: 'overdue',
        days_delta: daysPastDue,
      });

      if (daysPastDue <= 30) {
        summary.agingBuckets['1_30'].count += 1;
        summary.agingBuckets['1_30'].balance += balanceDue;
      } else if (daysPastDue <= 60) {
        summary.agingBuckets['31_60'].count += 1;
        summary.agingBuckets['31_60'].balance += balanceDue;
      } else if (daysPastDue <= 90) {
        summary.agingBuckets['61_90'].count += 1;
        summary.agingBuckets['61_90'].balance += balanceDue;
      } else {
        summary.agingBuckets['90_plus'].count += 1;
        summary.agingBuckets['90_plus'].balance += balanceDue;
      }

      continue;
    }

    summary.agingBuckets.current.count += 1;
    summary.agingBuckets.current.balance += balanceDue;

    if (dueDate <= dueSoonLimit) {
      summary.dueSoonBalance += balanceDue;
      summary.followUpInvoices.push({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_full_name: invoice.client_full_name,
        status: invoice.status,
        balance_due: balanceDue,
        due_at: invoice.due_at,
        urgency: 'due_soon',
        days_delta: daysUntilDue,
      });
    }
  }

  summary.followUpInvoices.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'overdue' ? -1 : 1;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return summary;
}
