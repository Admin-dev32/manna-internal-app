'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/guards';
import { buildServiceInterestSummary } from '@/lib/leads/service-interest';
import type { LeadFormState } from '@/services/leads/form-state';
import type { LeadPriority, LeadStatus } from '@/types/leads';

export interface UpdateLeadStatusResult {
  success: boolean;
  error?: string;
}

interface InlineLeadUpdateInput {
  status?: LeadStatus;
  priority?: LeadPriority;
  responsibleProfileId?: string | null;
  followUpAt?: string | null;
  nextAction?: string;
}

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

function parseServiceInterests(formData: FormData) {
  const selected = formData
    .getAll('service_interest_values')
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const customValue = parseOptionalString(formData.get('service_interest_custom'));
  const fallbackLegacy = parseOptionalSelectWithCustom(formData, 'service_interest');

  const combined = [...selected, ...(customValue ? [customValue] : []), ...(selected.length === 0 && !customValue && fallbackLegacy ? [fallbackLegacy] : [])];
  const normalized = [...new Set(combined)].slice(0, 3);

  return {
    serviceInterests: normalized.length > 0 ? normalized : null,
    serviceInterest: normalized.length > 0 ? buildServiceInterestSummary(normalized) : null,
  };
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

  const parsedServices = parseServiceInterests(formData);

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
      service_interest: parsedServices.serviceInterest,
      service_interests: parsedServices.serviceInterests,
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

function buildInlineLeadUpdate(input: InlineLeadUpdateInput, actorId: string) {
  const changes: Record<string, string | null> = {
    updated_by: actorId,
    last_interaction_at: new Date().toISOString(),
  };
  const details: string[] = [];

  if (input.status) {
    changes.status = input.status;
    details.push(`Estado: ${input.status}`);
  }

  if (input.priority) {
    changes.priority = input.priority;
    details.push(`Prioridad: ${input.priority}`);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'responsibleProfileId')) {
    changes.responsible_profile_id = input.responsibleProfileId ?? null;
    details.push(`Responsable: ${input.responsibleProfileId ?? 'sin asignar'}`);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'followUpAt')) {
    changes.follow_up_at = input.followUpAt ? parseOptionalDateTime(input.followUpAt) : null;
    details.push(`Seguimiento: ${changes.follow_up_at ?? 'sin seguimiento'}`);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'nextAction')) {
    const nextAction = input.nextAction?.trim() ?? '';
    if (!nextAction) {
      return { error: 'La próxima acción es obligatoria.' } as const;
    }

    changes.next_action = nextAction;
    details.push(`Próxima acción: ${nextAction}`);
  }

  if (details.length === 0) {
    return { error: 'No hay cambios rápidos para guardar.' } as const;
  }

  return {
    data: changes,
    summary: input.status && details.length === 1 ? 'Estado actualizado' : 'Lead actualizado desde el board',
    details: details.join(' · '),
    activityType: input.status && details.length === 1 ? ('estado' as const) : ('actualizado' as const),
  };
}

export async function updateLeadStatusAction(leadId: string, nextStatus: LeadStatus): Promise<UpdateLeadStatusResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { success: false, error: 'No fue posible abrir la conexión con Supabase.' };
  }

  const { error } = await supabase
    .from('leads')
    .update({
      status: nextStatus,
      updated_by: session.user.id,
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    return { success: false, error: 'No pudimos actualizar el estado del lead.' };
  }

  await insertActivity(leadId, session.user.id, 'Estado actualizado', `Nuevo estado: ${nextStatus}`, 'estado');

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true };
}

export async function updateLeadInlineAction(leadId: string, input: InlineLeadUpdateInput): Promise<UpdateLeadStatusResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { success: false, error: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = buildInlineLeadUpdate(input, session.user.id);
  if ('error' in payload) {
    return { success: false, error: payload.error };
  }

  const { error } = await supabase.from('leads').update(payload.data).eq('id', leadId);

  if (error) {
    return { success: false, error: 'No pudimos guardar el cambio rápido del lead.' };
  }

  await insertActivity(leadId, session.user.id, payload.summary, payload.details, payload.activityType);

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true };
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
