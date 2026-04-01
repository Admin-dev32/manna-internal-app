'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMentionableProfiles } from '@/services/internal-communication/queries';

function parseMentionHandles(body: string) {
  const matches = body.match(/@([a-z0-9_]+)/gi) ?? [];
  return [...new Set(matches.map((item) => item.slice(1).toLocaleLowerCase('es-MX')))];
}

export async function createChatMessageAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  if (!hasPermission(session.user, 'chat.send')) {
    return;
  }

  const conversationId = String(formData.get('conversation_id') ?? '').trim();
  const returnPath = String(formData.get('return_path') ?? '/chat').trim() as Route;
  const body = String(formData.get('body') ?? '').trim();

  if (!conversationId || !body) {
    redirect(returnPath);
  }

  const mentionableProfiles = await getMentionableProfiles();
  const handles = parseMentionHandles(body);
  const mentionedProfileIds = mentionableProfiles
    .filter((profile) => handles.includes(profile.handle))
    .map((profile) => profile.id);

  await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    sender_profile_id: session.user.id,
    body,
    metadata: {
      mention_handles: handles,
      mentioned_profile_ids: mentionedProfileIds,
    },
  });

  await supabase.from('chat_conversation_members').upsert({
    conversation_id: conversationId,
    profile_id: session.user.id,
    role: 'member',
    last_read_at: new Date().toISOString(),
  }, { onConflict: 'conversation_id,profile_id' });

  revalidatePath('/chat' as Route);
  revalidatePath('/eventos' as Route);
  redirect(returnPath);
}
