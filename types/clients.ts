import type { LeadLanguage } from '@/types/leads';

export interface ClientRecord {
  id: string;
  lead_id: string;
  source_quote_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  preferred_language: LeadLanguage | null;
  location: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
