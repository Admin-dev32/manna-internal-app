import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/guards';
import type { LeadProfileOption } from '@/types/leads';
import type {
  InternalCommentEntityType,
  InternalMentionNotification,
  InternalCommentMention,
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

function getEntityTypeLabel(entityType: InternalCommentEntityType) {
  switch (entityType) {
    case 'lead':
      return 'Lead';
    case 'quote':
      return 'Cotización';
    case 'client':
      return 'Cliente';
    case 'pre_event':
      return 'Reserva';
    case 'event':
      return 'Evento';
    case 'event_task':
      return 'Tarea';
    default:
      return 'Registro';
  }
}

async function getEntityLabelMap(entityType: InternalCommentEntityType, entityIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || entityIds.length === 0) return {} as Record<string, string>;

  const uniqueIds = [...new Set(entityIds)];

  if (entityType === 'lead') {
    const { data } = await supabase.from('leads').select('id, full_name').in('id', uniqueIds);
    const rows = (data ?? []) as Array<{ id: string; full_name: string | null }>;
    return Object.fromEntries(rows.map((item) => [String(item.id), String(item.full_name ?? 'Lead')])) as Record<string, string>;
  }

  if (entityType === 'quote') {
    const { data } = await supabase.from('quotes').select('id').in('id', uniqueIds);
    const rows = (data ?? []) as Array<{ id: string }>;
    return Object.fromEntries(rows.map((item) => [String(item.id), `Cotización #${String(item.id).slice(0, 8)}`])) as Record<string, string>;
  }

  if (entityType === 'client') {
    const { data } = await supabase.from('clients').select('id, full_name').in('id', uniqueIds);
    const rows = (data ?? []) as Array<{ id: string; full_name: string | null }>;
    return Object.fromEntries(rows.map((item) => [String(item.id), String(item.full_name ?? 'Cliente')])) as Record<string, string>;
  }

  if (entityType === 'pre_event') {
    const { data } = await supabase.from('pre_events').select('id, status').in('id', uniqueIds);
    const rows = (data ?? []) as Array<{ id: string; status: string | null }>;
    return Object.fromEntries(rows.map((item) => [String(item.id), `Reserva #${String(item.id).slice(0, 8)} · ${String(item.status ?? 'pendiente')}`])) as Record<string, string>;
  }

  if (entityType === 'event') {
    const { data } = await supabase.from('events').select('id, event_type').in('id', uniqueIds);
    const rows = (data ?? []) as Array<{ id: string; event_type: string | null }>;
    return Object.fromEntries(
      rows.map((item) => [String(item.id), String(item.event_type ?? `Evento #${String(item.id).slice(0, 8)}`)]),
    ) as Record<string, string>;
  }

  const { data } = await supabase.from('event_tasks').select('id, title').in('id', uniqueIds);
  const rows = (data ?? []) as Array<{ id: string; title: string | null }>;
  return Object.fromEntries(rows.map((item) => [String(item.id), String(item.title ?? 'Tarea operativa')])) as Record<string, string>;
}

export interface CommunicationHubEntry {
  id: string;
  entityType: InternalCommentEntityType;
  entityId: string;
  entityTypeLabel: string;
  entityLabel: string;
  href: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  body: string;
  mentionCount: number;
  mentionedUsers: string[];
}

export interface CommunicationHubFilters {
  channel: 'all' | 'mentions';
  module: 'all' | InternalCommentEntityType;
  timeframe: 'all' | '24h' | '7d';
}

export async function getCommunicationHubData(filters?: Partial<CommunicationHubFilters>) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [] as CommunicationHubEntry[];
  }

  const channel = filters?.channel ?? 'all';
  const moduleFilter = filters?.module ?? 'all';
  const timeframe = filters?.timeframe ?? 'all';

  let commentsQuery = supabase
    .from('internal_record_comments')
    .select('id, entity_type, entity_id, body, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  if (moduleFilter !== 'all') {
    commentsQuery = commentsQuery.eq('entity_type', moduleFilter);
  }

  if (timeframe === '24h') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    commentsQuery = commentsQuery.gte('created_at', since);
  }
  if (timeframe === '7d') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    commentsQuery = commentsQuery.gte('created_at', since);
  }

  const { data: commentRows } = await commentsQuery;
  const comments = (commentRows ?? []) as Array<Pick<InternalRecordComment, 'id' | 'entity_type' | 'entity_id' | 'body' | 'created_by' | 'created_at'>>;

  if (comments.length === 0) {
    return [] as CommunicationHubEntry[];
  }

  const commentIds = comments.map((comment) => comment.id);
  const { data: mentionRows } = await supabase
    .from('internal_comment_mentions')
    .select('id, comment_id, mentioned_profile_id, mention_key, created_at')
    .in('comment_id', commentIds);

  const mentions = (mentionRows ?? []) as InternalCommentMention[];
  const mentionsByCommentId = mentions.reduce(
    (accumulator, mention) => {
      const existing = accumulator[mention.comment_id] ?? [];
      existing.push(mention);
      accumulator[mention.comment_id] = existing;
      return accumulator;
    },
    {} as Record<string, InternalCommentMention[]>,
  );

  const filteredComments = channel === 'mentions' ? comments.filter((comment) => (mentionsByCommentId[comment.id] ?? []).length > 0) : comments;
  if (filteredComments.length === 0) {
    return [] as CommunicationHubEntry[];
  }

  const authorIds = filteredComments.map((comment) => comment.created_by);
  const mentionedIds = mentions.flatMap((mention) => mention.mentioned_profile_id);
  const profiles = await getProfilesMap([...authorIds, ...mentionedIds]);

  const taskIds = filteredComments.filter((comment) => comment.entity_type === 'event_task').map((comment) => comment.entity_id);
  const eventIdByTaskId = {} as Record<string, string>;
  if (taskIds.length > 0) {
    const { data: taskRows } = await supabase.from('event_tasks').select('id, event_id').in('id', [...new Set(taskIds)]);
    for (const task of taskRows ?? []) {
      eventIdByTaskId[String(task.id)] = String(task.event_id);
    }
  }

  const entityIdsByType = filteredComments.reduce(
    (accumulator, comment) => {
      const existing = accumulator[comment.entity_type] ?? [];
      existing.push(comment.entity_id);
      accumulator[comment.entity_type] = existing;
      return accumulator;
    },
    {} as Partial<Record<InternalCommentEntityType, string[]>>,
  );

  const entityLabelMaps = {} as Partial<Record<InternalCommentEntityType, Record<string, string>>>;
  for (const [entityType, entityIds] of Object.entries(entityIdsByType) as Array<[InternalCommentEntityType, string[]]>) {
    entityLabelMaps[entityType] = await getEntityLabelMap(entityType, entityIds);
  }

  return filteredComments.map((comment) => {
    const commentMentions = mentionsByCommentId[comment.id] ?? [];
    const mentionedUsers = commentMentions.map((mention) => profiles[mention.mentioned_profile_id]?.full_name ?? 'Usuario interno');
    const entityTypeLabel = getEntityTypeLabel(comment.entity_type);
    const entityLabel = entityLabelMaps[comment.entity_type]?.[comment.entity_id] ?? `${entityTypeLabel} #${comment.entity_id.slice(0, 8)}`;

    return {
      id: comment.id,
      entityType: comment.entity_type,
      entityId: comment.entity_id,
      entityTypeLabel,
      entityLabel,
      href: resolveEntityHref(comment.entity_type, comment.entity_id, eventIdByTaskId),
      authorId: comment.created_by,
      authorName: profiles[comment.created_by]?.full_name ?? 'Usuario interno',
      createdAt: comment.created_at,
      body: comment.body,
      mentionCount: commentMentions.length,
      mentionedUsers,
    } satisfies CommunicationHubEntry;
  });
}

export async function getMentionNotificationsForCurrentUser(limit = 20, unreadOnly = false) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return [] as Array<InternalMentionNotification & { href: string }>;

  const query = supabase
    .from('internal_mention_notifications')
    .select('*')
    .eq('profile_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data: notifications } = unreadOnly ? await query.eq('is_read', false) : await query;

  const mentionRows = (notifications ?? []) as InternalMentionNotification[];
  const taskIds = [...new Set(mentionRows.filter((row) => row.entity_type === 'event_task').map((row) => row.entity_id))];

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
