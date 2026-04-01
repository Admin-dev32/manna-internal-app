import { createClient } from '@supabase/supabase-js';

import { supabaseEnv } from '@/lib/supabase/env';

export function createSupabaseAdminClient() {
  if (!supabaseEnv.url || !supabaseEnv.serviceRoleKey) {
    return null;
  }

  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
