import { getDefaultCommunicationLanguage } from '@/services/communication/language';
import { getActiveEmailTemplateSelectionByPurpose } from '@/services/email-templates/queries';
import { renderEmailTemplate } from '@/services/email-templates/render';
import { getBusinessSettings } from '@/services/business-settings/queries';
import type { FinanceInvoiceDetail } from '@/services/invoices/queries';
import type { InvoiceEmailPurpose } from '@/types/invoices';
import {
  buildInvoiceEmailPlaceholderPayload,
  resolveInvoiceEmailPurpose,
  resolveInvoiceEmailRecipient,
  resolveInvoiceEmailSubject,
} from '@/services/invoices/email-send-helpers';

export { buildInvoiceEmailPlaceholderPayload, resolveInvoiceEmailPurpose, resolveInvoiceEmailRecipient, resolveInvoiceEmailSubject };

export async function composeInvoicePurposeEmail(args: {
  detail: FinanceInvoiceDetail;
  purpose: InvoiceEmailPurpose;
  subjectOverride?: string | null;
}) {
  const settings = await getBusinessSettings();
  const placeholders = buildInvoiceEmailPlaceholderPayload(args.detail, {
    businessName: settings.company_name,
    websiteUrl: settings.website_url,
    businessEmail: settings.email_reply_to,
    businessPhone: process.env.BUSINESS_PHONE?.trim() ?? null,
  });

  const language = getDefaultCommunicationLanguage();
  const templateSelection = await getActiveEmailTemplateSelectionByPurpose(args.purpose, language);
  const renderedTemplate = templateSelection.template ? renderEmailTemplate(templateSelection.template, placeholders) : null;

  const subject = resolveInvoiceEmailSubject({
    subjectOverride: args.subjectOverride,
    renderedSubject: renderedTemplate?.subject,
    invoiceNumber: args.detail.invoice.invoice_number,
  });

  const defaultText = [
    `Hola ${placeholders.customer_name ?? 'Cliente'},`,
    `Invoice ${args.detail.invoice.invoice_number}`,
    `Estado: ${args.detail.invoice.status}`,
    `Total: ${placeholders.total_amount ?? ''}`,
    `Saldo pendiente: ${placeholders.balance_due ?? ''}`,
    placeholders.payment_link_url ? `Payment link: ${placeholders.payment_link_url}` : '',
    `${placeholders.payment_note ?? ''}`,
    `${placeholders.business_name ?? 'Manna Snack Bars'} · ${placeholders.website_url ?? ''}`,
  ].filter(Boolean).join('\n');

  const html = renderedTemplate?.html?.trim()
    ? renderedTemplate.html
    : `<p>Hola ${placeholders.customer_name ?? 'Cliente'},</p><p>Invoice <strong>${args.detail.invoice.invoice_number}</strong></p><p>Total: <strong>${placeholders.total_amount ?? ''}</strong><br/>Saldo pendiente: <strong>${placeholders.balance_due ?? ''}</strong></p><p>${placeholders.payment_note ?? ''}</p>${placeholders.payment_link_url ? `<p><a href="${placeholders.payment_link_url}">Pagar invoice</a></p>` : ''}<p>${placeholders.business_name ?? 'Manna Snack Bars'} · ${placeholders.website_url ?? ''}</p>`;

  const text = renderedTemplate?.text?.trim() ? renderedTemplate.text : defaultText;

  return {
    placeholders,
    templateSelection,
    renderedTemplate,
    subject,
    html,
    text,
  };
}
