import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route';

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  return value;
}

function sanitizeFlow(value: string | null) {
  if (value === 'invite' || value === 'recovery') {
    return value;
  }

  return null;
}

function redirectToLogin(origin: string, message: string) {
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', message);
  return NextResponse.redirect(loginUrl);
}

function redirectToPasswordUpdate(origin: string, status: 'ready' | 'warning' | 'error', message: string, flow: 'invite' | 'recovery' | null) {
  const updatePasswordUrl = new URL('/actualizar-clave', origin);
  updatePasswordUrl.searchParams.set('status', status);
  updatePasswordUrl.searchParams.set('message', message);
  if (flow) {
    updatePasswordUrl.searchParams.set('flow', flow);
  }
  return NextResponse.redirect(updatePasswordUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const next = sanitizeNext(requestUrl.searchParams.get('next'));
  const flow = sanitizeFlow(requestUrl.searchParams.get('flow'));
  const errorDescription = requestUrl.searchParams.get('error_description');

  const isPasswordRecovery = next === '/actualizar-clave';

  if (errorDescription) {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(
        origin,
        'error',
        flow === 'invite'
          ? 'Tu invitación es inválida o expiró. Solicita al administrador una invitación nueva.'
          : 'El enlace de recuperación es inválido o expiró. Solicita uno nuevo.',
        flow,
      );
    }

    return redirectToLogin(origin, 'No se pudo completar la autenticación. Intenta de nuevo.');
  }

  const redirectResponse = NextResponse.redirect(new URL(next, origin));

  if (!code) {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(origin, 'warning', 'No detectamos un código válido en el enlace. Solicita un acceso nuevo.', flow);
    }

    return redirectResponse;
  }

  const { supabase, response } = createSupabaseRouteHandlerClient(request, redirectResponse);
  const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: null };

  if (error) {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(
        origin,
        'error',
        flow === 'invite'
          ? 'No pudimos validar tu invitación. Solicita al administrador que la reenvíe.'
          : 'No pudimos validar tu enlace de recuperación. Solicita uno nuevo.',
        flow,
      );
    }

    return redirectToLogin(origin, 'No se pudo completar la sesión. Solicita un acceso nuevo.');
  }

  if (isPasswordRecovery) {
    if (!supabase) {
      return redirectToPasswordUpdate(origin, 'error', 'No se pudo iniciar la recuperación en este entorno. Solicita un enlace nuevo.', flow);
    }

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      return redirectToPasswordUpdate(origin, 'error', 'No se pudo iniciar la sesión temporal de recuperación. Solicita un acceso nuevo.', flow);
    }

    return redirectToPasswordUpdate(
      origin,
      'ready',
      flow === 'invite'
        ? 'Invitación validada. Este es tu primer acceso: define una contraseña para activar tu ingreso.'
        : 'Enlace validado. Ahora puedes definir tu nueva contraseña.',
      flow,
    );
  }

  return response;
}
