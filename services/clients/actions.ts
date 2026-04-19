'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { normalizeCommunicationLanguage } from '@/services/communication/language';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function insertLeadActivity(leadId: string, actorId: string, summary: string, details: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'actualizado',
    summary,
    details,
    created_by: actorId,
  });
}

export interface ClientLanguageFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export async function convertLeadToClientAction(leadId: string, quoteId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const [{ data: existingClient }, { data: lead }, { data: quote }] = await Promise.all([
    supabase.from('clients').select('id').eq('lead_id', leadId).maybeSingle(),
    supabase.from('leads').select('*').eq('id', leadId).maybeSingle(),
    supabase.from('quotes').select('id, status').eq('id', quoteId).maybeSingle(),
  ]);

  if (existingClient?.id) {
    redirect(`/clientes/${existingClient.id}` as Route);
  }

  if (!lead || !quote || quote.status !== 'aceptada') {
    return;
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      lead_id: leadId,
      source_quote_id: quoteId,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email,
      preferred_language: lead.language,
      location: lead.location,
      notes: lead.internal_notes,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !client) {
    return;
  }

  await insertLeadActivity(leadId, session.user.id, 'Lead convertido a cliente', 'Se creó un cliente interno a partir de una cotización aceptada.');

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/clientes');
  redirect(`/clientes/${client.id}` as Route);
}

export async function updateClientPreferredLanguageAction(
  clientId: string,
  _previousState: ClientLanguageFormState,
  formData: FormData,
): Promise<ClientLanguageFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const rawLanguage = String(formData.get('preferred_language') ?? '').trim();
  const preferredLanguage = normalizeCommunicationLanguage(rawLanguage || null);
  if (!preferredLanguage) {
    return { status: 'error', message: 'Selecciona un idioma válido (es/en).' };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      preferred_language: preferredLanguage,
      updated_by: session.user.id,
    })
    .eq('id', clientId);

  if (error) {
    return { status: 'error', message: error.message || 'No se pudo actualizar el idioma preferido del cliente.' };
  }

  revalidatePath('/clientes' as Route);
  revalidatePath(`/clientes/${clientId}` as Route);
  return { status: 'success', message: 'Idioma de comunicación actualizado correctamente.' };
}
