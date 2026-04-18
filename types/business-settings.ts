export interface BusinessSettingsRecord {
  id: string;
  company_name: string;
  logo_url: string | null;
  website_url: string;
  zelle_recipient_name: string | null;
  zelle_recipient_contact: string | null;
  zelle_instructions: string;
  email_from_name: string;
  email_reply_to: string | null;
  operational_timezone: string;
  internal_payments_source: string;
  internal_payments_system: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface BusinessSettingsFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}
