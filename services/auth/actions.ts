'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';
import { getCurrentUserAccessContext, getProfileRecordByUserId, reconcileCurrentUserProfile } from '@/services/auth/profile';
import type { AuthActionState } from '@/services/auth/auth-action-state';

const corporateEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const disallowedNextPrefixes = ['/auth/', '/login', '/recuperar-acceso', '/actualizar-clave'];

function missingConfigurationState(message?: string): AuthActionState {
  return {
    status: 'error',
    message:
      message ?? 'Faltan las credenciales de Supabase en el entorno. Configura la app antes de usar autenticación real.',
  };
}

function sanitizeRedirectTarget(value: string | null): Route {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }

  if (disallowedNextPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
    return '/dashboard';
  }

  return value as Route;
}

function mapLoginSupabaseError(message: string | undefined) {
  const normalized = (message ?? '').toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Tu correo aún no está confirmado. Revisa tu bandeja o contacta al administrador.';
  }

  if (normalized.includes('too many requests')) {
    return 'Detectamos demasiados intentos seguidos. Espera unos minutos e inténtalo nuevamente.';
  }

  return 'No fue posible iniciar sesión por un problema temporal. Intenta de nuevo en unos minutos.';
}

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!hasSupabaseCredentials()) {
    return missingConfigurationState();
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = sanitizeRedirectTarget(formData.get('next')?.toString() ?? null);

  if (!email || !password) {
    return {
      status: 'error',
      message: 'Ingresa tu correo y contraseña para continuar.',
    };
  }

  if (!corporateEmailPattern.test(email)) {
    return {
      status: 'error',
      message: 'Ingresa un correo válido para iniciar sesión.',
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return missingConfigurationState();
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: 'error',
      message: mapLoginSupabaseError(error.message),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      message: 'La sesión no pudo establecerse correctamente. Intenta de nuevo.',
    };
  }

  let profile = await getProfileRecordByUserId(supabase, user.id);

  if (!profile) {
    const reconciledProfile = await reconcileCurrentUserProfile(supabase);
    if (reconciledProfile) {
      profile = reconciledProfile;
    }
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      message: 'Tu usuario no tiene un perfil interno válido. Ya intentamos reconciliarlo automáticamente; contacta al administrador.',
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      message: 'Tu cuenta está inactiva. Contacta al administrador del sistema.',
    };
  }

  const accessContext = await getCurrentUserAccessContext(supabase);

  if (!accessContext || accessContext.is_active === false) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      message: 'No pudimos validar tu acceso interno en este momento. Solicita soporte para revisar tu perfil.',
    };
  }

  if (!Array.isArray(accessContext.permissions) || accessContext.permissions.length === 0) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      message: 'Tu usuario no tiene permisos activos para ingresar. Contacta al administrador.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function recoverAccessAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!hasSupabaseCredentials()) {
    return missingConfigurationState();
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    return {
      status: 'error',
      message: 'Ingresa tu correo para recibir el enlace de recuperación.',
    };
  }

  if (!corporateEmailPattern.test(email)) {
    return {
      status: 'error',
      message: 'Ingresa un correo válido (ej. nombre@manna.com) para continuar.',
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return missingConfigurationState();
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${supabaseEnv.appUrl}/auth/callback?next=/actualizar-clave&flow=recovery`,
  });

  if (error) {
    return {
      status: 'error',
      message: 'No pudimos enviar el enlace de recuperación. Verifica tu correo e inténtalo otra vez en unos minutos.',
    };
  }

  return {
    status: 'success',
    message: 'Si el correo está autorizado, recibirás un enlace seguro en breve. Revisa bandeja principal, spam y promociones.',
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!hasSupabaseCredentials()) {
    return missingConfigurationState();
  }

  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const flow = formData.get('flow') === 'invite' || formData.get('flow') === 'recovery'
    ? (formData.get('flow') as 'invite' | 'recovery')
    : null;

  if (password.length < 8) {
    return {
      status: 'error',
      message: 'La nueva contraseña debe tener al menos 8 caracteres.',
    };
  }

  if (password !== confirmPassword) {
    return {
      status: 'error',
      message: 'Las contraseñas no coinciden.',
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return missingConfigurationState();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn('[auth] updatePasswordAction: recovery session missing or invalid', {
      hasUser: Boolean(user),
      error: userError?.message ?? null,
      flow,
    });

    return {
      status: 'error',
      message: 'No encontramos una sesión válida de recuperación. Abre de nuevo el enlace más reciente de tu correo o solicita uno nuevo.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      status: 'error',
      message: 'No fue posible actualizar tu contraseña. Solicita un enlace nuevo e inténtalo otra vez.',
    };
  }

  return {
    status: 'success',
    message:
      flow === 'invite'
        ? 'Tu acceso inicial quedó configurado correctamente. Redirigiendo al inicio de sesión…'
        : 'Tu contraseña fue actualizada correctamente. Redirigiendo al acceso…',
  };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase?.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
