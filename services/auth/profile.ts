import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfileRecord } from '@/types/auth';

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
