'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { normalizeCommunicationLanguage } from '@/services/communication/language';
import { findUnsupportedTemplatePlaceholdersForPurpose } from '@/services/email-templates/render';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMAIL_TEMPLATE_PURPOSES, type EmailTemplateActionState, type EmailTemplatePurpose } from '@/types/email-templates';

function normalizeRequired(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function normalizeOptional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeKey(value: string) {
  return value
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function validateTemplatePlaceholders(
  subjectTemplate: string,
  htmlTemplate: string,
  textTemplate: string | null,
  purpose: EmailTemplatePurpose,
) {
  const unsupported = [
    ...findUnsupportedTemplatePlaceholdersForPurpose(subjectTemplate, purpose),
    ...findUnsupportedTemplatePlaceholdersForPurpose(htmlTemplate, purpose),
    ...(textTemplate ? findUnsupportedTemplatePlaceholdersForPurpose(textTemplate, purpose) : []),
  ];

  const uniqueUnsupported = [...new Set(unsupported)];
  if (uniqueUnsupported.length === 0) return null;

  return `La plantilla contiene placeholders no permitidos: ${uniqueUnsupported.map((item) => `{{${item}}}`).join(', ')}.`;
}

async function revalidateEmailTemplatePaths() {
  revalidatePath('/configuracion' as Route);
  revalidatePath('/configuracion/plantillas-email' as Route);
  revalidatePath('/cotizaciones' as Route);
}

export async function createEmailTemplateAction(
  _previousState: EmailTemplateActionState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const key = normalizeKey(normalizeRequired(formData.get('key')));
  const name = normalizeRequired(formData.get('name'));
  const purpose = normalizeRequired(formData.get('purpose'));
  const language = normalizeCommunicationLanguage(normalizeRequired(formData.get('language')));
  const subjectTemplate = normalizeRequired(formData.get('subject_template'));
  const htmlTemplate = normalizeRequired(formData.get('html_template'));
  const textTemplate = normalizeOptional(formData.get('text_template'));

  if (!key || !name || !subjectTemplate || !htmlTemplate) {
    return { status: 'error', message: 'Completa key, nombre, asunto y HTML para crear la plantilla.' };
  }

  if (!EMAIL_TEMPLATE_PURPOSES.includes(purpose as (typeof EMAIL_TEMPLATE_PURPOSES)[number])) {
    return { status: 'error', message: 'Selecciona un propósito válido para la plantilla.' };
  }
  if (!language) {
    return { status: 'error', message: 'Selecciona un idioma válido para la plantilla (es/en).' };
  }
  const placeholdersError = validateTemplatePlaceholders(
    subjectTemplate,
    htmlTemplate,
    textTemplate,
    purpose as EmailTemplatePurpose,
  );
  if (placeholdersError) {
    return { status: 'error', message: placeholdersError };
  }

  const { error } = await supabase.from('email_templates').insert({
    key,
    name,
    purpose,
    language,
    subject_template: subjectTemplate,
    html_template: htmlTemplate,
    text_template: textTemplate,
    is_active: false,
    updated_by: session.user.id,
  });

  if (error) {
    return { status: 'error', message: error.message || 'No se pudo crear la plantilla de email.' };
  }

  await revalidateEmailTemplatePaths();
  return { status: 'success', message: 'Plantilla creada correctamente.' };
}

export async function updateEmailTemplateAction(
  templateId: string,
  _previousState: EmailTemplateActionState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const name = normalizeRequired(formData.get('name'));
  const purpose = normalizeRequired(formData.get('purpose'));
  const language = normalizeCommunicationLanguage(normalizeRequired(formData.get('language')));
  const subjectTemplate = normalizeRequired(formData.get('subject_template'));
  const htmlTemplate = normalizeRequired(formData.get('html_template'));
  const textTemplate = normalizeOptional(formData.get('text_template'));

  if (!name || !subjectTemplate || !htmlTemplate) {
    return { status: 'error', message: 'Completa nombre, asunto y HTML para guardar cambios.' };
  }
  if (!language) {
    return { status: 'error', message: 'Selecciona un idioma válido para la plantilla (es/en).' };
  }
  if (!EMAIL_TEMPLATE_PURPOSES.includes(purpose as EmailTemplatePurpose)) {
    return { status: 'error', message: 'No se pudo validar placeholders porque el propósito de la plantilla es inválido.' };
  }
  const placeholdersError = validateTemplatePlaceholders(
    subjectTemplate,
    htmlTemplate,
    textTemplate,
    purpose as EmailTemplatePurpose,
  );
  if (placeholdersError) {
    return { status: 'error', message: placeholdersError };
  }

  const { error } = await supabase
    .from('email_templates')
    .update({
      name,
      language,
      subject_template: subjectTemplate,
      html_template: htmlTemplate,
      text_template: textTemplate,
      updated_by: session.user.id,
    })
    .eq('id', templateId);

  if (error) {
    return { status: 'error', message: error.message || 'No se pudo actualizar la plantilla de email.' };
  }

  await revalidateEmailTemplatePaths();
  return { status: 'success', message: 'Plantilla actualizada correctamente.' };
}

export async function toggleEmailTemplateActiveAction(templateId: string, nextActive: boolean) {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  const { data: current } = await supabase
    .from('email_templates')
    .select('id, purpose, language')
    .eq('id', templateId)
    .maybeSingle();

  if (!current) return;

  if (nextActive) {
    await supabase
      .from('email_templates')
      .update({ is_active: false, updated_by: session.user.id })
      .eq('purpose', current.purpose)
      .eq('language', current.language);
  }

  await supabase
    .from('email_templates')
    .update({ is_active: nextActive, updated_by: session.user.id })
    .eq('id', templateId);

  await revalidateEmailTemplatePaths();
}
