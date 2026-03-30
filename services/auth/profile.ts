import type { SupabaseClient } from '@supabase/supabase-js';

import type { CurrentUserAccessContext, ProfileRecord } from '@/types/auth';

export async function getProfileRecordByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as ProfileRecord | null;
}

export async function getCurrentUserAccessContext(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_current_user_access_context');

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const [context] = data;
  return context as CurrentUserAccessContext;
}
