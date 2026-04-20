'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { InternalTicketCategory, InternalTicketPriority, InternalTicketStatus } from '@/types/internal-tickets';

const VALID_STATUSES = new Set<InternalTicketStatus>(['open', 'in_progress', 'closed']);
const VALID_PRIORITIES = new Set<InternalTicketPriority>(['low', 'normal', 'high', 'urgent']);
const VALID_CATEGORIES = new Set<InternalTicketCategory>([
  'approval',
  'missing_material',
  'event_issue',
  'urgent_purchase',
  'operational_incident',
  'general_request',
]);

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

async function validateOperationalSender(profileId: string, eventId: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;

  let query = supabase
    .from('event_staff_assignments')
    .select('id')
    .eq('profile_id', profileId)
    .in('assignment_role', ['supervisor', 'team_leader', 'assistant', 'lider', 'apoyo'])
    .in('assignment_status', ['accepted', 'confirmado'])
    .limit(1);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data } = await query;
  return (data ?? []).length > 0;
}

export async function createInternalTicketAction(
  _previousState: EmployeeActionFormState,
  formData: FormData,
): Promise<EmployeeActionFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'internal_tickets.create')) {
    return { status: 'error', message: 'No tienes permiso para crear tickets internos.' };
  }

  const subject = String(formData.get('subject') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priorityRaw = String(formData.get('priority') ?? 'normal');
  const categoryRaw = String(formData.get('category') ?? 'general_request');
  const eventId = normalizeOptionalString(formData.get('event_id'));

  if (!subject || !description) {
    return { status: 'error', message: 'Escribe asunto y descripción para enviar el ticket.' };
  }

  if (!VALID_PRIORITIES.has(priorityRaw as InternalTicketPriority) || !VALID_CATEGORIES.has(categoryRaw as InternalTicketCategory)) {
    return { status: 'error', message: 'Prioridad o categoría inválida.' };
  }

  const isOperationalSender = await validateOperationalSender(session.user.id, eventId);
  if (!isOperationalSender && !hasPermission(session.user, 'internal_tickets.manage')) {
    return { status: 'error', message: 'Solo Supervisor / Team Leader / Assistant pueden crear tickets operativos.' };
  }

  const { error } = await supabase.from('internal_tickets').insert({
    subject,
    description,
    priority: priorityRaw,
    category: categoryRaw,
    event_id: eventId,
    created_by: session.user.id,
    status: 'open',
  });

  if (error) {
    return { status: 'error', message: 'No pudimos crear el ticket interno.' };
  }

  revalidatePath('/empleados' as Route);
  revalidatePath('/oficina-solicitudes' as Route);
  return { status: 'success', message: 'Ticket enviado a main office.' };
}

export async function updateInternalTicketStatusAction(ticketId: string, formData: FormData) {
  await requirePermission('internal_tickets.manage');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const nextStatus = String(formData.get('status') ?? 'open') as InternalTicketStatus;
  const officeResponse = normalizeOptionalString(formData.get('office_response'));
  const assignedTo = normalizeOptionalString(formData.get('assigned_to'));

  if (!VALID_STATUSES.has(nextStatus)) return;

  await supabase
    .from('internal_tickets')
    .update({
      status: nextStatus,
      office_response: officeResponse,
      assigned_to: assignedTo,
      closed_at: nextStatus === 'closed' ? new Date().toISOString() : null,
      closed_by: nextStatus === 'closed' ? session.user.id : null,
    })
    .eq('id', ticketId);

  revalidatePath('/oficina-solicitudes' as Route);
  revalidatePath('/empleados' as Route);
}
