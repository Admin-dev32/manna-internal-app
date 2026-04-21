import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseCredentials } from '@/lib/supabase/env';
import { normalizeOperationalProfile, normalizeRole, toSystemBaseRole } from '@/lib/auth/roles';
import { getCurrentUserAccessContext, getProfileRecordByUserId, reconcileCurrentUserProfile } from '@/services/auth/profile';
import { PERMISSION_KEYS } from '@/types/auth';
import type { AppUser, SessionContext } from '@/types/auth';

const demoUser: AppUser = {
  id: 'demo-owner',
  nombre: 'Equipo Manna',
  email: 'demo@manna.local',
  rol: 'owner',
  baseRole: 'owner',
  operationalProfile: 'general_staff',
  estado: 'activo',
  permissions: [...PERMISSION_KEYS],
  isSiteOwner: true,
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

  let [profile, accessContext] = await Promise.all([getProfileRecordByUserId(supabase, user.id), getCurrentUserAccessContext(supabase)]);

  if (!profile) {
    const reconciledProfile = await reconcileCurrentUserProfile(supabase);
    if (reconciledProfile) {
      profile = reconciledProfile;
      accessContext = (await getCurrentUserAccessContext(supabase)) ?? accessContext;
    }
  }

  const roleFromAuth = user.app_metadata?.role ?? user.user_metadata?.role;
  const fullName = user.user_metadata?.full_name ?? user.user_metadata?.nombre;
  const normalizedRole = normalizeRole(accessContext?.role ?? profile?.role ?? roleFromAuth);
  const isActiveProfile = profile?.is_active === true;
  const isActiveContext = accessContext?.is_active !== false;

  return {
    user: {
      id: user.id,
      nombre: profile?.full_name ?? fullName ?? user.email?.split('@')[0] ?? 'Empleado',
      email: user.email ?? 'sin-correo@manna.local',
      rol: normalizedRole,
      baseRole: accessContext?.base_role ?? toSystemBaseRole(normalizedRole),
      operationalProfile: normalizeOperationalProfile(accessContext?.operational_profile),
      estado: isActiveProfile && isActiveContext ? 'activo' : 'inactivo',
      permissions: accessContext?.permissions ?? [],
      isSiteOwner: accessContext?.is_site_owner ?? normalizedRole === 'owner',
    },
    isAuthenticated: true,
    isDemoMode: false,
  };
});

export async function getCurrentUserRole() {
  const session = await getSessionContext();
  return session.user?.rol ?? null;
}
