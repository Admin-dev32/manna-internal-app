'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/guards';
import type { LeadFormState } from '@/services/leads/form-state';
import type { LeadPriority, LeadStatus } from '@/types/leads';

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  const parsed = parseOptionalNumber(value);
  return Number.isInteger(parsed) ? parsed : parsed === null ? null : Math.round(parsed);
}

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseOptionalSelectWithCustom(formData: FormData, fieldName: string) {
  const selectedOption = parseOptionalString(formData.get(`${fieldName}_option`));
  const customValue = parseOptionalString(formData.get(`${fieldName}_custom`));
  const fallbackValue = parseOptionalString(formData.get(fieldName));

  if (selectedOption === 'Otro') {
    return customValue;
  }

  return selectedOption ?? fallbackValue;
}

function sanitizeLeadPayload(formData: FormData, actorId: string) {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as LeadStatus;
  const nextAction = String(formData.get('next_action') ?? '').trim();
  const priority = (String(formData.get('priority') ?? 'media').trim() || 'media') as LeadPriority;

  if (!fullName) {
    return { error: 'El nombre del lead es obligatorio.' };
  }

  if (!status) {
    return { error: 'El estado es obligatorio.' };
  }

  if (!nextAction) {
    return { error: 'La próxima acción es obligatoria.' };
  }

  return {
    data: {
      full_name: fullName,
      phone: parseOptionalString(formData.get('phone')),
      email: parseOptionalString(formData.get('email')),
      language: String(formData.get('language') ?? 'es').trim() || 'es',
      source_platform: parseOptionalSelectWithCustom(formData, 'source_platform'),
      status,
      priority,
      event_type: parseOptionalSelectWithCustom(formData, 'event_type'),
      tentative_event_date: parseOptionalString(formData.get('tentative_event_date')),
      tentative_event_time: parseOptionalString(formData.get('tentative_event_time')),
      location: parseOptionalString(formData.get('location')),
      guest_count: parseOptionalInteger(formData.get('guest_count')),
      service_interest: parseOptionalSelectWithCustom(formData, 'service_interest'),
      quoted_total: parseOptionalNumber(formData.get('quoted_total')),
      promotion_offered: parseOptionalString(formData.get('promotion_offered')),
      next_action: nextAction,
      follow_up_at: parseOptionalDateTime(formData.get('follow_up_at')),
      responsible_profile_id: parseOptionalString(formData.get('responsible_profile_id')),
      internal_notes: parseOptionalString(formData.get('internal_notes')),
      updated_by: actorId,
      last_interaction_at: new Date().toISOString(),
    },
  };
}

async function insertActivity(leadId: string, actorId: string, summary: string, details: string | null, activityType: 'creado' | 'actualizado' | 'nota' | 'estado') {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: activityType,
    summary,
    details,
    created_by: actorId,
  });
}

export async function createLeadAction(_previousState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeLeadPayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...payload.data,
      created_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { status: 'error', message: 'No pudimos crear el lead. Intenta de nuevo.' };
  }

  await insertActivity(data.id, session.user.id, 'Lead creado', payload.data.next_action, 'creado');

  revalidatePath('/leads');
  redirect(`/leads/${data.id}` as Route);
}

export async function updateLeadAction(
  leadId: string,
  _previousState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeLeadPayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const { error } = await supabase.from('leads').update(payload.data).eq('id', leadId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar los cambios del lead.' };
  }

  await insertActivity(leadId, session.user.id, 'Lead actualizado', payload.data.next_action, 'actualizado');

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}` as Route);
}
