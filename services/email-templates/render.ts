import type { EmailTemplateRecord } from '@/types/email-templates';
import type { EmailTemplatePurpose } from '@/types/email-templates';

export const EMAIL_TEMPLATE_BASE_PLACEHOLDERS = [
  'client_name',
  'event_date',
  'event_time',
  'company_name',
] as const;

export const EMAIL_TEMPLATE_PURPOSE_PLACEHOLDERS: Record<EmailTemplatePurpose, readonly string[]> = {
  quote_delivery: ['quote_total', 'payment_link', 'zelle_instructions', 'balance_due', 'deposit_amount'],
  quote_followup: ['quote_total', 'payment_link', 'balance_due', 'deposit_amount'],
  payment_reminder: ['quote_total', 'payment_link', 'balance_due', 'deposit_amount'],
  event_confirmation: ['event_address', 'service_label'],
  general_client_message: ['quote_total'],
};

export const EMAIL_TEMPLATE_ALLOWED_PLACEHOLDERS = [
  ...EMAIL_TEMPLATE_BASE_PLACEHOLDERS,
  ...new Set(Object.values(EMAIL_TEMPLATE_PURPOSE_PLACEHOLDERS).flat()),
] as const;

export type EmailTemplatePlaceholder = (typeof EMAIL_TEMPLATE_ALLOWED_PLACEHOLDERS)[number];

export type EmailTemplateRenderContext = Partial<Record<EmailTemplatePlaceholder, string>>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplateString(template: string, context: EmailTemplateRenderContext, options?: { htmlEscapeValues?: boolean }) {
  return template.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_match, rawKey) => {
    const key = String(rawKey).toLowerCase() as EmailTemplatePlaceholder;
    if (!EMAIL_TEMPLATE_ALLOWED_PLACEHOLDERS.includes(key)) {
      return '';
    }

    const value = context[key] ?? '';
    return options?.htmlEscapeValues === false ? value : escapeHtml(value);
  });
}

export function extractTemplatePlaceholders(template: string) {
  const matches = template.match(/{{\s*([a-z0-9_]+)\s*}}/gi) ?? [];
  return matches.map((match) => match.replace(/[{}]/g, '').trim().toLowerCase());
}

export function findUnsupportedTemplatePlaceholders(template: string) {
  const placeholders = extractTemplatePlaceholders(template);
  const unsupported = placeholders.filter((placeholder) => !EMAIL_TEMPLATE_ALLOWED_PLACEHOLDERS.includes(placeholder as EmailTemplatePlaceholder));
  return [...new Set(unsupported)];
}

export function getAllowedPlaceholdersForPurpose(purpose: EmailTemplatePurpose) {
  return [...EMAIL_TEMPLATE_BASE_PLACEHOLDERS, ...(EMAIL_TEMPLATE_PURPOSE_PLACEHOLDERS[purpose] ?? [])];
}

export function findUnsupportedTemplatePlaceholdersForPurpose(template: string, purpose: EmailTemplatePurpose) {
  const allowed = getAllowedPlaceholdersForPurpose(purpose);
  const placeholders = extractTemplatePlaceholders(template);
  const unsupported = placeholders.filter((placeholder) => !allowed.includes(placeholder));
  return [...new Set(unsupported)];
}

export function renderEmailTemplate(
  template: Pick<EmailTemplateRecord, 'subject_template' | 'html_template' | 'text_template'>,
  context: EmailTemplateRenderContext,
) {
  return {
    subject: renderTemplateString(template.subject_template, context, { htmlEscapeValues: false }),
    html: renderTemplateString(template.html_template, context, { htmlEscapeValues: true }),
    text: template.text_template ? renderTemplateString(template.text_template, context, { htmlEscapeValues: false }) : null,
  };
}

export function getEmailTemplatePreviewSampleData(): EmailTemplateRenderContext {
  return {
    client_name: 'Cliente Demo',
    event_date: 'sábado, 24 de mayo de 2026',
    event_time: '18:00',
    quote_total: '$45,000.00 MXN',
    payment_link: 'https://payments.manna.local/link-demo',
    balance_due: '$31,500.00 MXN',
    deposit_amount: '$13,500.00 MXN',
    event_address: 'Av. Reforma 123, CDMX',
    service_label: 'Barra premium para boda',
    company_name: 'Manna Snack Bars',
    zelle_instructions: 'También aceptamos pago por Zelle. Responde este correo con tu comprobante para confirmar tu fecha.',
  };
}
