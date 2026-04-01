import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ChatConversationRecord, ChatMessageRecord } from '@/types/chat';
import type { LeadProfileOption } from '@/types/leads';
import type { EventRecord } from '@/types/events';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);
  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function ensureGlobalTeamConversation(userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('conversation_type', 'global_team')
    .is('event_id', null)
    .maybeSingle();

  if (existing) {
    await supabase.from('chat_conversation_members').upsert({
      conversation_id: existing.id,
      profile_id: userId,
      role: 'member',
    }, { onConflict: 'conversation_id,profile_id' });

    return existing as ChatConversationRecord;
  }

  const { data: created } = await supabase
    .from('chat_conversations')
    .insert({
      conversation_type: 'global_team',
      event_id: null,
      title: 'Canal global del equipo',
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .maybeSingle();

  if (!created) return null;

  await supabase.from('chat_conversation_members').upsert({
    conversation_id: created.id,
    profile_id: userId,
    role: 'moderator',
  }, { onConflict: 'conversation_id,profile_id' });

  return created as ChatConversationRecord;
}

export async function ensureEventConversation(eventId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('conversation_type', 'event')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    await supabase.from('chat_conversation_members').upsert({
      conversation_id: existing.id,
      profile_id: userId,
      role: 'member',
    }, { onConflict: 'conversation_id,profile_id' });

    return existing as ChatConversationRecord;
  }

  const { data: eventData } = await supabase
    .from('events')
    .select('id, event_type, event_date')
    .eq('id', eventId)
    .maybeSingle();

  const event = (eventData as Pick<EventRecord, 'id' | 'event_type' | 'event_date'> | null) ?? null;
  if (!event) return null;

  const { data: created } = await supabase
    .from('chat_conversations')
    .insert({
      conversation_type: 'event',
      event_id: event.id,
      title: `Evento · ${event.event_type ?? 'Operativo'} · ${event.event_date}`,
      is_active: true,
      created_by: userId,
    })
    .select('*')
    .maybeSingle();

  if (!created) return null;

  await supabase.from('chat_conversation_members').upsert({
    conversation_id: created.id,
    profile_id: userId,
    role: 'moderator',
  }, { onConflict: 'conversation_id,profile_id' });

  return created as ChatConversationRecord;
}

export async function getChatMessages(conversationId: string, limit = 80) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      messages: [] as ChatMessageRecord[],
      profiles: {} as Record<string, LeadProfileOption>,
    };
  }

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  const messages = (data ?? []) as ChatMessageRecord[];
  const profiles = await getProfilesMap(messages.map((item) => item.sender_profile_id));

  return { messages, profiles };
}

export async function getChatSidebarConversations() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ChatConversationRecord[];

  const { data } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('is_active', true)
    .order('conversation_type', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(120);

  return (data ?? []) as ChatConversationRecord[];
}
