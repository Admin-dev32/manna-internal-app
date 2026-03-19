import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route';

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const next = sanitizeNext(requestUrl.searchParams.get('next'));
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (errorDescription) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'No se pudo completar la autenticación. Intenta de nuevo.');
    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(new URL(next, origin));

  if (!code) {
    return redirectResponse;
  }

  const { supabase, response } = createSupabaseRouteHandlerClient(request, redirectResponse);
  const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: null };

  if (error) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'No se pudo completar la sesión. Solicita un acceso nuevo.');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
