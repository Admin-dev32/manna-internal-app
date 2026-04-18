export const CLIENT_COMMUNICATION_LANGUAGES = ['es', 'en'] as const;

export type ClientCommunicationLanguage = (typeof CLIENT_COMMUNICATION_LANGUAGES)[number];

export type CommunicationLanguageResolutionSource = 'client_preference' | 'lead_language' | 'default';
