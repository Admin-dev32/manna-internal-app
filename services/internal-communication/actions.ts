'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InternalCommentEntityType } from '@/types/internal-communication';

function toHandle(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function extractMentionKeys(body: string) {
  const matches = body.matchAll(/@([\p{L}0-9_.-]+)/gu);
  return [...new Set(Array.from(matches, (match) => match[1].toLocaleLowerCase('es-MX')))];
}

export async function createInternalRecordCommentAction(entityType: InternalCommentEntityType, entityId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  const body = String(formData.get('body') ?? '').trim();
  const returnPath = String(formData.get('return_path') ?? '').trim();
  if (!body) return;

  const { data: comment } = await supabase
    .from('internal_record_comments')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      body,
      created_by: session.user.id,
    })
    .select('*')
    .single();

  if (comment) {
    const mentionKeys = extractMentionKeys(body);
    if (mentionKeys.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, is_active').eq('is_active', true);

      const mentionableByKey = Object.fromEntries(
        (profiles ?? []).flatMap((profile) => {
          const fullName = String(profile.full_name ?? '').trim();
          if (!fullName) return [];
          const keys = [toHandle(fullName), ...fullName.split(/\s+/g).map((part) => toHandle(part))].filter(Boolean);
          return keys.map((key) => [key, String(profile.id)]);
        }),
      ) as Record<string, string>;

      const mentionedProfileIds = [...new Set(mentionKeys.map((key) => mentionableByKey[key]).filter(Boolean))];

      for (const profileId of mentionedProfileIds) {
        const mentionKey = mentionKeys.find((key) => mentionableByKey[key] === profileId) ?? 'usuario';

        const { data: mentionRow } = await supabase
          .from('internal_comment_mentions')
          .insert({
            comment_id: comment.id,
            mentioned_profile_id: profileId,
            mention_key: mentionKey,
          })
          .select('id')
          .single();

        if (!mentionRow) continue;

        await supabase.from('internal_mention_notifications').insert({
          mention_id: mentionRow.id,
          profile_id: profileId,
          entity_type: entityType,
          entity_id: entityId,
        });
      }
    }
  }

  if (returnPath) {
    revalidatePath(returnPath as Route);
  }
  revalidatePath('/notificaciones' as Route);
  revalidatePath('/dashboard' as Route);
}

export async function markInternalMentionNotificationReadAction(notificationId: string, returnPath?: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  await supabase
    .from('internal_mention_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('profile_id', session.user.id);

  revalidatePath('/notificaciones' as Route);
  revalidatePath('/dashboard' as Route);
  if (returnPath) revalidatePath(returnPath as Route);
}

export async function markAllInternalMentionNotificationsReadAction(returnPath?: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return;

  await supabase
    .from('internal_mention_notifications')
    .update({ is_read: true })
    .eq('profile_id', session.user.id)
    .eq('is_read', false);

  revalidatePath('/notificaciones' as Route);
  revalidatePath('/dashboard' as Route);
  if (returnPath) revalidatePath(returnPath as Route);
}
