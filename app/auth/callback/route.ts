import { type NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

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

function sanitizeOtpType(value: string | null): EmailOtpType | null {
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

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

function redirectToPasswordUpdate(
  origin: string,
  status: 'ready' | 'warning' | 'error',
  message: string,
  flow: 'invite' | 'recovery' | null,
  sourceResponse?: NextResponse,
) {
  const updatePasswordUrl = new URL('/actualizar-clave', origin);
  updatePasswordUrl.searchParams.set('status', status);
  updatePasswordUrl.searchParams.set('message', message);
  if (flow) {
    updatePasswordUrl.searchParams.set('flow', flow);
  }

  const redirectResponse = NextResponse.redirect(updatePasswordUrl);
  if (sourceResponse) {
    copyResponseCookies(sourceResponse, redirectResponse);
  }

  return redirectResponse;
}

function resolveFlow(flow: 'invite' | 'recovery' | null, otpType: EmailOtpType | null): 'invite' | 'recovery' | null {
  if (flow) return flow;
  if (otpType === 'invite' || otpType === 'recovery') return otpType;
  return null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const next = sanitizeNext(requestUrl.searchParams.get('next'));
  const flow = sanitizeFlow(requestUrl.searchParams.get('flow'));
  const otpType = sanitizeOtpType(requestUrl.searchParams.get('type'));
  const resolvedFlow = resolveFlow(flow, otpType);
  const errorDescription = requestUrl.searchParams.get('error_description');

  const isPasswordRecovery = next === '/actualizar-clave' || resolvedFlow !== null;

  if (errorDescription) {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(
        origin,
        'error',
        resolvedFlow === 'invite'
          ? 'Tu invitación es inválida o expiró. Solicita al administrador una invitación nueva.'
          : 'El enlace de recuperación es inválido o expiró. Solicita uno nuevo.',
        resolvedFlow,
      );
    }

    return redirectToLogin(origin, 'No se pudo completar la autenticación. Intenta de nuevo.');
  }

  const redirectResponse = NextResponse.redirect(new URL(next, origin));
  const { supabase, response } = createSupabaseRouteHandlerClient(request, redirectResponse);
  if (!supabase) {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(
        origin,
        'error',
        'No se pudo iniciar la recuperación en este entorno. Solicita un enlace nuevo.',
        resolvedFlow,
      );
    }
    return redirectResponse;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      if (isPasswordRecovery) {
        return redirectToPasswordUpdate(
          origin,
          'error',
          resolvedFlow === 'invite'
            ? 'No pudimos validar tu invitación. Solicita al administrador que la reenvíe.'
            : 'No pudimos validar tu enlace de recuperación. Solicita uno nuevo.',
          resolvedFlow,
          response,
        );
      }

      return redirectToLogin(origin, 'No se pudo completar la sesión. Solicita un acceso nuevo.');
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (error) {
      if (isPasswordRecovery) {
        return redirectToPasswordUpdate(
          origin,
          'error',
          resolvedFlow === 'invite'
            ? 'No pudimos validar tu invitación. Solicita al administrador que la reenvíe.'
            : 'No pudimos validar tu enlace de recuperación. Solicita uno nuevo.',
          resolvedFlow,
          response,
        );
      }

      return redirectToLogin(origin, 'No se pudo completar la sesión. Solicita un acceso nuevo.');
    }
  } else {
    if (isPasswordRecovery) {
      return redirectToPasswordUpdate(
        origin,
        'warning',
        'No detectamos credenciales válidas en el enlace. Solicita un acceso nuevo.',
        resolvedFlow,
      );
    }

    return redirectResponse;
  }

  if (isPasswordRecovery) {
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      return redirectToPasswordUpdate(
        origin,
        'error',
        'No se pudo iniciar la sesión temporal de recuperación. Solicita un acceso nuevo.',
        resolvedFlow,
        response,
      );
    }

    return redirectToPasswordUpdate(
      origin,
      'ready',
      resolvedFlow === 'invite'
        ? 'Invitación validada. Este es tu primer acceso: define una contraseña para activar tu ingreso.'
        : 'Enlace validado. Ahora puedes definir tu nueva contraseña.',
      resolvedFlow,
      response,
    );
  }

  return response;
}
