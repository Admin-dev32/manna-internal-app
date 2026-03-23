import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';

export function createSupabaseRouteHandlerClient(request: NextRequest, response: NextResponse) {
  if (!hasSupabaseCredentials()) {
    return { supabase: null, response };
  }

  const supabase = createServerClient(supabaseEnv.url!, supabaseEnv.anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  return { supabase, response };
}
