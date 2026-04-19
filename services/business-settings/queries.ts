import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BusinessSettingsRecord } from '@/types/business-settings';

function normalizeOptional(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function getDefaultBusinessSettings(): Omit<BusinessSettingsRecord, 'id' | 'created_at' | 'updated_at' | 'updated_by'> {
  return {
    company_name: process.env.QUOTE_COMPANY_NAME?.trim() || process.env.EMAIL_FROM_NAME?.trim() || 'Manna Snack Bars',
    logo_url: normalizeOptional(process.env.QUOTE_LOGO_URL),
    website_url: process.env.QUOTE_WEBSITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://mannasnackbars.com',
    zelle_recipient_name: normalizeOptional(process.env.QUOTE_ZELLE_RECIPIENT_NAME),
    zelle_recipient_contact: normalizeOptional(process.env.QUOTE_ZELLE_RECIPIENT_CONTACT),
    zelle_instructions:
      process.env.QUOTE_ZELLE_INSTRUCTIONS?.trim() ||
      'También aceptamos pago por Zelle. Responde este correo con tu comprobante para confirmar tu fecha.',
    email_from_name: process.env.EMAIL_FROM_NAME?.trim() || 'Manna Snack Bars',
    email_reply_to: normalizeOptional(process.env.EMAIL_REPLY_TO),
    operational_timezone: process.env.INTERNAL_PAYMENTS_TIMEZONE?.trim() || 'America/Los_Angeles',
    internal_payments_source: process.env.INTERNAL_PAYMENTS_SOURCE?.trim() || 'manna_internal_app',
    internal_payments_system: process.env.INTERNAL_PAYMENTS_SYSTEM?.trim() || 'stripe',
  };
}

function mergeWithDefaults(row: Partial<BusinessSettingsRecord> | null): Omit<BusinessSettingsRecord, 'id' | 'created_at' | 'updated_at' | 'updated_by'> {
  const defaults = getDefaultBusinessSettings();

  return {
    company_name: normalizeOptional(row?.company_name) ?? defaults.company_name,
    logo_url: normalizeOptional(row?.logo_url) ?? defaults.logo_url,
    website_url: normalizeOptional(row?.website_url) ?? defaults.website_url,
    zelle_recipient_name: normalizeOptional(row?.zelle_recipient_name) ?? defaults.zelle_recipient_name,
    zelle_recipient_contact: normalizeOptional(row?.zelle_recipient_contact) ?? defaults.zelle_recipient_contact,
    zelle_instructions: normalizeOptional(row?.zelle_instructions) ?? defaults.zelle_instructions,
    email_from_name: normalizeOptional(row?.email_from_name) ?? defaults.email_from_name,
    email_reply_to: normalizeOptional(row?.email_reply_to) ?? defaults.email_reply_to,
    operational_timezone: normalizeOptional(row?.operational_timezone) ?? defaults.operational_timezone,
    internal_payments_source: normalizeOptional(row?.internal_payments_source) ?? defaults.internal_payments_source,
    internal_payments_system: normalizeOptional(row?.internal_payments_system) ?? defaults.internal_payments_system,
  };
}

export async function getBusinessSettingsRecord() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null as BusinessSettingsRecord | null;
  }

  const { data } = await supabase
    .from('business_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as BusinessSettingsRecord | null) ?? null;
}

export async function getBusinessSettings() {
  const row = await getBusinessSettingsRecord();
  return mergeWithDefaults(row);
}
