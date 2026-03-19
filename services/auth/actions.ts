'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseCredentials, supabaseEnv } from '@/lib/supabase/env';

export interface AuthActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialAuthActionState: AuthActionState = {
  status: 'idle',
};

function missingConfigurationState(message?: string): AuthActionState {
  return {
    status: 'error',
    message:
      message ?? 'Faltan las credenciales de Supabase en el entorno. Configura la app antes de usar autenticación real.',
  };
}

function sanitizeRedirectTarget(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  return value;
}

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!hasSupabaseCredentials()) {
    return missingConfigurationState();
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = sanitizeRedirectTarget(formData.get('next')?.toString() ?? null);

  if (!email || !password) {
    return {
      status: 'error',
      message: 'Ingresa tu correo y contraseña para continuar.',
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
      message: 'No fue posible iniciar sesión. Verifica tus credenciales e inténtalo otra vez.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(next);

  return {
    status: 'success',
  };
}

export async function recoverAccessAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!hasSupabaseCredentials()) {
    return missingConfigurationState();
  }

  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return {
      status: 'error',
      message: 'Ingresa tu correo para recibir el enlace de recuperación.',
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return missingConfigurationState();
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${supabaseEnv.appUrl}/auth/callback?next=/actualizar-clave`,
  });

  if (error) {
    return {
      status: 'error',
      message: 'No pudimos enviar el enlace de recuperación. Intenta de nuevo en unos minutos.',
    };
  }

  return {
    status: 'success',
    message: 'Te enviamos un enlace seguro para restablecer tu acceso.',
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

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      status: 'error',
      message: 'No fue posible actualizar tu contraseña. Solicita un enlace nuevo e inténtalo otra vez.',
    };
  }

  return {
    status: 'success',
    message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión con la nueva clave.',
  };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase?.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
