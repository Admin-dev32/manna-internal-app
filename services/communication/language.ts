import type { LeadLanguage } from '@/types/leads';
import { CLIENT_COMMUNICATION_LANGUAGES, type ClientCommunicationLanguage, type CommunicationLanguageResolutionSource } from '@/types/communication';

const FALLBACK_LANGUAGE: ClientCommunicationLanguage = 'es';

function isSupportedLanguage(value: string | null | undefined): value is ClientCommunicationLanguage {
  return CLIENT_COMMUNICATION_LANGUAGES.includes((value ?? '') as ClientCommunicationLanguage);
}

export function normalizeCommunicationLanguage(value: string | null | undefined): ClientCommunicationLanguage | null {
  if (!isSupportedLanguage(value)) return null;
  return value;
}

export function getDefaultCommunicationLanguage(): ClientCommunicationLanguage {
  const envLanguage = normalizeCommunicationLanguage(process.env.DEFAULT_COMMUNICATION_LANGUAGE);
  return envLanguage ?? FALLBACK_LANGUAGE;
}

export function resolveCommunicationLanguage({
  clientPreferredLanguage,
  leadLanguage,
}: {
  clientPreferredLanguage: string | null | undefined;
  leadLanguage: LeadLanguage | null | undefined;
}): { language: ClientCommunicationLanguage; source: CommunicationLanguageResolutionSource } {
  const normalizedClientLanguage = normalizeCommunicationLanguage(clientPreferredLanguage);
  if (normalizedClientLanguage) {
    return { language: normalizedClientLanguage, source: 'client_preference' };
  }

  const normalizedLeadLanguage = normalizeCommunicationLanguage(leadLanguage);
  if (normalizedLeadLanguage) {
    return { language: normalizedLeadLanguage, source: 'lead_language' };
  }

  return { language: getDefaultCommunicationLanguage(), source: 'default' };
}

export function resolveClientCommunicationLanguage(args: {
  clientPreferredLanguage: string | null | undefined;
  leadLanguage: LeadLanguage | null | undefined;
}) {
  return resolveCommunicationLanguage(args);
}

export function getCommunicationLanguageLabel(language: string | null | undefined) {
  const normalized = normalizeCommunicationLanguage(language);
  if (normalized === 'en') return 'Inglés';
  if (normalized === 'es') return 'Español';
  return 'Sin definir';
}

export function getCommunicationLanguageSourceLabel(source: CommunicationLanguageResolutionSource) {
  if (source === 'client_preference') return 'Idioma preferido del cliente';
  if (source === 'lead_language') return 'Idioma del lead';
  return 'Configuración por defecto del sistema';
}
