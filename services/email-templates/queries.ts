import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDefaultCommunicationLanguage } from '@/services/communication/language';
import type { ClientCommunicationLanguage } from '@/types/communication';
import type { EmailTemplatePurpose, EmailTemplateRecord } from '@/types/email-templates';
export interface ActiveEmailTemplateSelection {
  template: EmailTemplateRecord | null;
  requestedLanguage: ClientCommunicationLanguage;
  resolvedLanguage: ClientCommunicationLanguage | null;
  resolution: 'exact' | 'default_fallback' | 'missing';
}

export async function getEmailTemplates() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EmailTemplateRecord[];

  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .order('purpose', { ascending: true })
    .order('language', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as EmailTemplateRecord[];
}

export async function getActiveEmailTemplateByPurpose(
  purpose: EmailTemplatePurpose,
  language: ClientCommunicationLanguage,
) {
  const selection = await getActiveEmailTemplateSelectionByPurpose(purpose, language);
  return selection.template;
}

export async function getActiveEmailTemplateSelectionByPurpose(
  purpose: EmailTemplatePurpose,
  language: ClientCommunicationLanguage,
): Promise<ActiveEmailTemplateSelection> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      template: null,
      requestedLanguage: language,
      resolvedLanguage: null,
      resolution: 'missing',
    };
  }

  const { data: byLanguage } = await supabase
    .from('email_templates')
    .select('*')
    .eq('purpose', purpose)
    .eq('language', language)
    .eq('is_active', true)
    .maybeSingle();

  if (byLanguage) {
    return {
      template: byLanguage as EmailTemplateRecord,
      requestedLanguage: language,
      resolvedLanguage: language,
      resolution: 'exact',
    };
  }

  const defaultLanguage = getDefaultCommunicationLanguage();
  if (language === defaultLanguage) {
    return {
      template: null,
      requestedLanguage: language,
      resolvedLanguage: null,
      resolution: 'missing',
    };
  }

  const { data: fallback } = await supabase
    .from('email_templates')
    .select('*')
    .eq('purpose', purpose)
    .eq('language', defaultLanguage)
    .eq('is_active', true)
    .maybeSingle();

  if (fallback) {
    return {
      template: fallback as EmailTemplateRecord,
      requestedLanguage: language,
      resolvedLanguage: defaultLanguage,
      resolution: 'default_fallback',
    };
  }

  return {
    template: null,
    requestedLanguage: language,
    resolvedLanguage: null,
    resolution: 'missing',
  };
}
