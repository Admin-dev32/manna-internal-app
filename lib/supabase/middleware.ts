import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';

export interface MiddlewareSessionResult {
  response: NextResponse;
  user: User | null;
}

export async function updateSession(request: NextRequest): Promise<MiddlewareSessionResult> {
  if (!hasSupabaseCredentials()) {
    return {
      response: NextResponse.next({ request }),
      user: null,
    };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseEnv.url!, supabaseEnv.anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
