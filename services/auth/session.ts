import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseCredentials } from '@/lib/supabase/env';
import { normalizeRole } from '@/lib/auth/roles';
import { getProfileRecordByUserId } from '@/services/auth/profile';
import type { AppUser, SessionContext } from '@/types/auth';

const demoUser: AppUser = {
  id: 'demo-owner',
  nombre: 'Equipo Manna',
  email: 'demo@manna.local',
  rol: 'owner',
  estado: 'activo',
};

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  if (!hasSupabaseCredentials()) {
    return {
      user: demoUser,
      isAuthenticated: true,
      isDemoMode: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
    };
  }

  const profile = await getProfileRecordByUserId(supabase, user.id);
  const roleFromAuth = user.app_metadata?.role ?? user.user_metadata?.role;
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.nombre;

  return {
    user: {
      id: user.id,
      nombre: profile?.full_name ?? fullName ?? user.email?.split('@')[0] ?? 'Empleado',
      email: user.email ?? 'sin-correo@manna.local',
      rol: normalizeRole(profile?.role ?? roleFromAuth),
      estado: profile?.is_active === false ? 'inactivo' : 'activo',
    },
    isAuthenticated: true,
    isDemoMode: false,
  };
});

export async function getCurrentUserRole() {
  const session = await getSessionContext();
  return session.user?.rol ?? null;
}
