import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';

export async function createSupabaseServerClient() {
  if (!hasSupabaseCredentials()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseEnv.url!, supabaseEnv.anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Next.js puede impedir escrituras de cookies desde algunos Server Components.
        }
      },
    },
  });
}
