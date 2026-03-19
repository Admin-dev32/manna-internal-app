import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseCredentials } from '@/lib/supabase/env';
import { normalizeRole } from '@/lib/auth/roles';
import type { AppUser, ProfileRecord, SessionContext } from '@/types/auth';

const demoUser: AppUser = {
  id: 'demo-owner',
  nombre: 'Equipo Manna',
  email: 'demo@manna.local',
  rol: 'owner',
  estado: 'activo',
};

async function getProfileRecord(userId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  const profile = data as ProfileRecord | null;

  if (error) return null;

  return profile;
}

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
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
    };
  }

  const profile = await getProfileRecord(user.id);
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
