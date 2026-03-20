'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { QuoteFormState } from '@/services/quotes/form-state';
import type { QuoteStatus } from '@/types/quotes';

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

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitizeQuotePayload(formData: FormData, actorId: string) {
  const status = (parseOptionalString(formData.get('status')) ?? 'borrador') as QuoteStatus;
  const totalAmount = parseOptionalNumber(formData.get('total_amount'));
  const expectedDeposit = parseOptionalNumber(formData.get('expected_deposit'));
  const estimatedBalanceInput = parseOptionalNumber(formData.get('estimated_balance'));

  if (totalAmount === null || totalAmount < 0) {
    return { error: 'El total cotizado es obligatorio.' } as const;
  }

  const estimatedBalance =
    estimatedBalanceInput ?? (expectedDeposit !== null ? Math.max(totalAmount - expectedDeposit, 0) : totalAmount);

  return {
    data: {
      status,
      subtotal: parseOptionalNumber(formData.get('subtotal')),
      discount_amount: parseOptionalNumber(formData.get('discount_amount')),
      promotion_note: parseOptionalString(formData.get('promotion_note')),
      total_amount: totalAmount,
      expected_deposit: expectedDeposit,
      estimated_balance: estimatedBalance,
      notes: parseOptionalString(formData.get('notes')),
      sent_at: parseOptionalDateTime(formData.get('sent_at')),
      updated_by: actorId,
    },
  } as const;
}

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

async function syncLeadQuotedTotal(leadId: string, actorId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const { data } = await supabase
    .from('quotes')
    .select('total_amount, status, updated_at')
    .eq('lead_id', leadId)
    .order('updated_at', { ascending: false });

  const quotes = data ?? [];
  const preferredQuote =
    quotes.find((quote) => ['borrador', 'enviada', 'aceptada', 'vencida'].includes(String(quote.status))) ?? quotes[0] ?? null;

  await supabase
    .from('leads')
    .update({
      quoted_total: preferredQuote?.total_amount ?? null,
      updated_by: actorId,
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

async function updateLeadCommercialState(leadId: string, actorId: string, nextStatus: 'ganado' | 'seguimiento') {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase
    .from('leads')
    .update({
      status: nextStatus,
      updated_by: actorId,
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

export async function createQuoteAction(leadId: string, _previousState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeQuotePayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      lead_id: leadId,
      ...payload.data,
      created_by: session.user.id,
    })
    .select('id, total_amount, status')
    .single();

  if (error || !data) {
    return { status: 'error', message: 'No pudimos crear la cotización. Intenta de nuevo.' };
  }

  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(
    leadId,
    session.user.id,
    'Cotización creada',
    `Estado: ${data.status} · Total: $${Number(data.total_amount).toFixed(2)}`,
  );

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${data.id}` as Route);
}

export async function updateQuoteAction(quoteId: string, leadId: string, _previousState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeQuotePayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const { error } = await supabase.from('quotes').update(payload.data).eq('id', quoteId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar los cambios de la cotización.' };
  }

  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(
    leadId,
    session.user.id,
    'Cotización actualizada',
    `Estado: ${payload.data.status} · Total: $${Number(payload.data.total_amount).toFixed(2)}`,
  );

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${quoteId}` as Route);
}

export async function acceptQuoteAction(quoteId: string, leadId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  await supabase
    .from('quotes')
    .update({
      status: 'aceptada',
      updated_by: session.user.id,
    })
    .eq('id', quoteId);

  await updateLeadCommercialState(leadId, session.user.id, 'ganado');
  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(leadId, session.user.id, 'Cotización aceptada', 'La propuesta comercial fue marcada como aceptada y el lead avanzó a ganado.');

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
}

export async function rejectQuoteAction(quoteId: string, leadId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  await supabase
    .from('quotes')
    .update({
      status: 'rechazada',
      updated_by: session.user.id,
    })
    .eq('id', quoteId);

  await updateLeadCommercialState(leadId, session.user.id, 'seguimiento');
  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(leadId, session.user.id, 'Cotización rechazada', 'La propuesta fue rechazada y el lead quedó abierto en seguimiento para una posible nueva oferta.');

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
}
