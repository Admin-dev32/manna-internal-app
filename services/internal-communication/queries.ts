import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadProfileOption } from '@/types/leads';
import type {
  InternalCommentEntityType,
  InternalMentionNotification,
  InternalRecordComment,
  RecordTimelineItem,
} from '@/types/internal-communication';

function toHandle(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

export async function getMentionableProfiles() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as Array<{ id: string; fullName: string; handle: string }>;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  return (data ?? [])
    .map((profile) => {
      const fullName = String(profile.full_name ?? '').trim();
      if (!fullName) return null;
      return {
        id: String(profile.id),
        fullName,
        handle: toHandle(fullName),
      };
    })
    .filter(Boolean) as Array<{ id: string; fullName: string; handle: string }>;
}

export async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getRecordComments(entityType: InternalCommentEntityType, entityId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InternalRecordComment[];

  const { data } = await supabase
    .from('internal_record_comments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(30);

  return (data ?? []) as InternalRecordComment[];
}

export async function getRecordTimeline(entityType: InternalCommentEntityType, entityId: string) {
  const comments = await getRecordComments(entityType, entityId);

  const items = [] as RecordTimelineItem[];

  for (const comment of comments) {
    items.push({
      id: comment.id,
      kind: 'comment',
      title: 'Comentario interno',
      body: comment.body,
      created_by: comment.created_by,
      created_at: comment.created_at,
    });
  }

  if (entityType === 'lead') {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from('lead_activities')
        .select('id, title, description, created_by, created_at')
        .eq('lead_id', entityId)
        .order('created_at', { ascending: false })
        .limit(20);

      for (const activity of data ?? []) {
        items.push({
          id: `lead-activity-${activity.id}`,
          kind: 'activity',
          title: String(activity.title ?? 'Actividad'),
          body: (activity.description as string | null) ?? null,
          created_by: String(activity.created_by),
          created_at: String(activity.created_at),
        });
      }
    }
  }

  return items.sort((left, right) => right.created_at.localeCompare(left.created_at)) as RecordTimelineItem[];
}

function resolveEntityHref(entityType: InternalCommentEntityType, entityId: string, eventIdByTaskId: Record<string, string>) {
  switch (entityType) {
    case 'lead':
      return `/leads/${entityId}`;
    case 'quote':
      return `/cotizaciones/${entityId}`;
    case 'client':
      return `/clientes/${entityId}`;
    case 'pre_event':
      return `/reservas/${entityId}`;
    case 'event':
      return `/eventos/${entityId}`;
    case 'event_task':
      return eventIdByTaskId[entityId] ? `/eventos/${eventIdByTaskId[entityId]}` : '/tareas';
    default:
      return '/notificaciones';
  }
}

export async function getMentionNotificationsForCurrentUser(limit = 20, unreadOnly = false) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as Array<InternalMentionNotification & { href: string }>;

  const query = supabase
    .from('internal_mention_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data: notifications } = unreadOnly ? await query.eq('is_read', false) : await query;

  const mentionRows = (notifications ?? []) as InternalMentionNotification[];
  const taskIds = mentionRows.filter((row) => row.entity_type === 'event_task').map((row) => row.entity_id);

  const eventIdByTaskId = {} as Record<string, string>;
  if (taskIds.length > 0) {
    const { data: taskRows } = await supabase.from('event_tasks').select('id, event_id').in('id', taskIds);
    for (const task of taskRows ?? []) {
      eventIdByTaskId[String(task.id)] = String(task.event_id);
    }
  }

  return mentionRows.map((row) => ({
    ...row,
    href: resolveEntityHref(row.entity_type, row.entity_id, eventIdByTaskId),
  }));
}
