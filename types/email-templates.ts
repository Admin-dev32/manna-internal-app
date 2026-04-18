import type { ClientCommunicationLanguage } from '@/types/communication';

export const EMAIL_TEMPLATE_PURPOSES = [
  'quote_delivery',
  'quote_followup',
  'payment_reminder',
  'event_confirmation',
  'general_client_message',
] as const;

export type EmailTemplatePurpose = (typeof EMAIL_TEMPLATE_PURPOSES)[number];

export interface EmailTemplateRecord {
  id: string;
  key: string;
  name: string;
  purpose: EmailTemplatePurpose;
  language: ClientCommunicationLanguage;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface EmailTemplateActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}
