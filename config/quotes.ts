import type { QuoteStatus } from '@/types/quotes';

export const quoteStatusOptions: Array<{ value: QuoteStatus; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'vencida', label: 'Vencida' },
];

export const quoteStatusLabels = Object.fromEntries(quoteStatusOptions.map((option) => [option.value, option.label])) as Record<QuoteStatus, string>;

export interface QuoteCommercialBrandingConfig {
  companyName: string;
  websiteUrl: string;
  logoUrl: string | null;
  zelleRecipientName: string | null;
  zelleRecipientContact: string | null;
  zelleInstructions: string;
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getQuoteCommercialBrandingConfig(): QuoteCommercialBrandingConfig {
  const companyName = process.env.QUOTE_COMPANY_NAME?.trim() || process.env.EMAIL_FROM_NAME?.trim() || 'Manna Snack Bars';
  const websiteUrl = process.env.QUOTE_WEBSITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://mannasnackbars.com';

  return {
    companyName,
    websiteUrl,
    logoUrl: normalizeOptional(process.env.QUOTE_LOGO_URL),
    zelleRecipientName: normalizeOptional(process.env.QUOTE_ZELLE_RECIPIENT_NAME),
    zelleRecipientContact: normalizeOptional(process.env.QUOTE_ZELLE_RECIPIENT_CONTACT),
    zelleInstructions:
      process.env.QUOTE_ZELLE_INSTRUCTIONS?.trim() ||
      'Si prefieres Zelle, responde este correo y te compartimos la confirmación de pago para bloquear fecha.',
  };
}
