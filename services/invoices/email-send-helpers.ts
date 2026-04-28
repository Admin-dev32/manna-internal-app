const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InvoiceEmailRecipientResolution {
  recipient: string | null;
  source: 'override' | 'client' | 'manual' | 'missing';
  error: string | null;
}

export interface InvoiceEmailPlaceholderSource {
  invoice: {
    invoice_number: string;
    status: string;
    issued_at: string | null;
    due_at: string | null;
    subtotal: number | string | null;
    discount_amount: number | string | null;
    total_amount: number | string | null;
    deposit_amount: number | string | null;
    balance_due: number | string | null;
    notes: string | null;
    currency: string | null;
    manual_customer_name: string | null;
    manual_customer_email: string | null;
  };
  client: {
    full_name: string | null;
    email: string | null;
  } | null;
  preEvent: {
    confirmed_date: string | null;
  } | null;
  event: {
    event_date: string | null;
  } | null;
  paymentLinks: Array<{ external_url: string }>;
  source_label: string;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function resolveInvoiceEmailPurpose(inputPurpose: 'invoice_delivery' | 'invoice_reminder' | null | undefined): 'invoice_delivery' | 'invoice_reminder' {
  return inputPurpose === 'invoice_reminder' ? 'invoice_reminder' : 'invoice_delivery';
}

export function resolveInvoiceEmailRecipient(args: {
  recipientOverride?: string | null;
  clientEmail?: string | null;
  manualCustomerEmail?: string | null;
}): InvoiceEmailRecipientResolution {
  const recipientOverride = normalizeOptional(args.recipientOverride);
  if (recipientOverride) {
    if (!isValidEmail(recipientOverride)) {
      return {
        recipient: null,
        source: 'override',
        error: 'recipientOverride tiene formato de email inválido.',
      };
    }

    return { recipient: recipientOverride, source: 'override', error: null };
  }

  const clientEmail = normalizeOptional(args.clientEmail);
  if (clientEmail) {
    if (!isValidEmail(clientEmail)) {
      return {
        recipient: null,
        source: 'client',
        error: 'El email del cliente asociado es inválido.',
      };
    }

    return { recipient: clientEmail, source: 'client', error: null };
  }

  const manualCustomerEmail = normalizeOptional(args.manualCustomerEmail);
  if (manualCustomerEmail) {
    if (!isValidEmail(manualCustomerEmail)) {
      return {
        recipient: null,
        source: 'manual',
        error: 'El manual_customer_email del invoice es inválido.',
      };
    }

    return { recipient: manualCustomerEmail, source: 'manual', error: null };
  }

  return { recipient: null, source: 'missing', error: 'No hay email destinatario válido para este invoice.' };
}

function formatCurrency(value: number | string | null, currency: string | null | undefined) {
  const numericValue = Number(value ?? 0);
  const safeCurrency = String(currency ?? 'USD').toUpperCase();
  const validCurrency = /^[A-Z]{3}$/.test(safeCurrency) ? safeCurrency : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: validCurrency }).format(
    Number.isFinite(numericValue) ? numericValue : 0,
  );
}

function formatDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatCurrentDate(now: Date) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(now);
}

export function buildInvoiceEmailPlaceholderPayload(
  detail: InvoiceEmailPlaceholderSource,
  args?: {
    now?: Date;
    businessName?: string | null;
    businessPhone?: string | null;
    businessEmail?: string | null;
    websiteUrl?: string | null;
  },
): Record<string, string> {
  const now = args?.now ?? new Date();
  const paymentLink = detail.paymentLinks[0] ?? null;
  const businessName = normalizeOptional(args?.businessName) ?? 'Manna Snack Bars';
  const websiteUrl = normalizeOptional(args?.websiteUrl) ?? 'https://mannasnackbars.com';

  const paymentLinkUrl = paymentLink?.external_url ? String(paymentLink.external_url) : '';
  const paymentLinkLabel = paymentLink ? 'Pagar invoice ahora' : 'Solicitar link de pago';
  const paymentNote = paymentLink
    ? 'El payment link es un canal de cobro y no confirma pago por sí solo.'
    : 'No online payment link available yet. Reply to this email and we will share one.';

  const customerName =
    normalizeOptional(detail.client?.full_name) ??
    normalizeOptional(detail.invoice.manual_customer_name) ??
    'Cliente';
  const customerEmail =
    normalizeOptional(detail.client?.email) ??
    normalizeOptional(detail.invoice.manual_customer_email) ??
    '';

  return {
    invoice_number: detail.invoice.invoice_number,
    invoice_status: detail.invoice.status,
    source_label: detail.source_label,
    issued_at: formatDateTime(detail.invoice.issued_at),
    due_at: formatDateTime(detail.invoice.due_at),
    subtotal: formatCurrency(detail.invoice.subtotal, detail.invoice.currency),
    discount_amount: formatCurrency(detail.invoice.discount_amount, detail.invoice.currency),
    total_amount: formatCurrency(detail.invoice.total_amount, detail.invoice.currency),
    deposit_amount: formatCurrency(detail.invoice.deposit_amount, detail.invoice.currency),
    balance_due: formatCurrency(detail.invoice.balance_due, detail.invoice.currency),
    notes: normalizeOptional(detail.invoice.notes) ?? '',
    customer_name: customerName,
    customer_email: customerEmail,
    business_name: businessName,
    business_phone: normalizeOptional(args?.businessPhone) ?? '',
    business_email: normalizeOptional(args?.businessEmail) ?? '',
    website_url: websiteUrl,
    payment_link_url: paymentLinkUrl,
    payment_link_label: paymentLinkLabel,
    payment_note: paymentNote,
    current_date: formatCurrentDate(now),
    company_name: businessName,
    client_name: customerName,
    event_date: detail.preEvent?.confirmed_date ?? detail.event?.event_date ?? '',
    event_time: '',
  };
}

export function resolveInvoiceEmailSubject(args: {
  subjectOverride?: string | null;
  renderedSubject?: string | null;
  invoiceNumber: string;
}) {
  const subjectOverride = normalizeOptional(args.subjectOverride);
  if (subjectOverride) return subjectOverride;

  const renderedSubject = normalizeOptional(args.renderedSubject);
  if (renderedSubject) return renderedSubject;

  return `Invoice ${args.invoiceNumber}`;
}
