import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient() {
  if (!hasSupabaseCredentials()) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseEnv.url!, supabaseEnv.anonKey!);
  }

  return browserClient;
}
