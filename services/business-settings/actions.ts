'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BusinessSettingsFormState } from '@/types/business-settings';

function normalizeOptional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeRequired(value: FormDataEntryValue | null, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export async function saveBusinessSettingsAction(
  _previousState: BusinessSettingsFormState,
  formData: FormData,
): Promise<BusinessSettingsFormState> {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const companyName = normalizeRequired(formData.get('company_name'));
  const websiteUrl = normalizeRequired(formData.get('website_url'));
  const zelleInstructions = normalizeRequired(formData.get('zelle_instructions'));
  const emailFromName = normalizeRequired(formData.get('email_from_name'));
  const operationalTimezone = normalizeRequired(formData.get('operational_timezone'));
  const internalPaymentsSource = normalizeRequired(formData.get('internal_payments_source'));
  const internalPaymentsSystem = normalizeRequired(formData.get('internal_payments_system'));

  if (!companyName || !websiteUrl || !zelleInstructions || !emailFromName || !operationalTimezone || !internalPaymentsSource || !internalPaymentsSystem) {
    return { status: 'error', message: 'Completa los campos requeridos para guardar la configuración.' };
  }

  const { data: existing } = await supabase
    .from('business_settings')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    company_name: companyName,
    logo_url: normalizeOptional(formData.get('logo_url')),
    website_url: websiteUrl,
    zelle_recipient_name: normalizeOptional(formData.get('zelle_recipient_name')),
    zelle_recipient_contact: normalizeOptional(formData.get('zelle_recipient_contact')),
    zelle_instructions: zelleInstructions,
    email_from_name: emailFromName,
    email_reply_to: normalizeOptional(formData.get('email_reply_to')),
    operational_timezone: operationalTimezone,
    internal_payments_source: internalPaymentsSource,
    internal_payments_system: internalPaymentsSystem,
    updated_by: session.user.id,
  };

  const result = existing?.id
    ? await supabase.from('business_settings').update(payload).eq('id', existing.id)
    : await supabase.from('business_settings').insert(payload);

  if (result.error) {
    return { status: 'error', message: result.error.message || 'No se pudo guardar la configuración de negocio/pagos.' };
  }

  revalidatePath('/configuracion' as Route);
  revalidatePath('/configuracion/negocio-pagos' as Route);
  revalidatePath('/cotizaciones' as Route);
  revalidatePath('/reservas' as Route);

  return { status: 'success', message: 'Configuración de negocio y pagos guardada correctamente.' };
}
