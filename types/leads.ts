export const LEAD_STATUSES = ['nuevo', 'contactado', 'seguimiento', 'calificado', 'ganado', 'perdido'] as const;
export const LEAD_PRIORITIES = ['baja', 'media', 'alta', 'urgente'] as const;
export const LEAD_LANGUAGES = ['es', 'en'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export type LeadLanguage = (typeof LEAD_LANGUAGES)[number];
export type LeadViewMode = 'table' | 'kanban' | 'calendar' | 'cards';

export interface LeadRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  language: LeadLanguage;
  source_platform: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  event_type: string | null;
  tentative_event_date: string | null;
  tentative_event_time: string | null;
  location: string | null;
  guest_count: number | null;
  service_interest: string | null;
  service_interests: string[] | null;
  quoted_total: number | string | null;
  promotion_offered: string | null;
  next_action: string;
  follow_up_at: string | null;
  responsible_profile_id: string | null;
  internal_notes: string | null;
  last_interaction_at: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeadActivityRecord {
  id: string;
  lead_id: string;
  activity_type: 'creado' | 'actualizado' | 'nota' | 'estado';
  summary: string;
  details: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface LeadProfileOption {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}
