import { redirect } from 'next/navigation';

import { canAccessRole } from '@/lib/auth/roles';
import { isSupabaseAuthEnabled } from '@/lib/supabase/env';
import { getSessionContext } from '@/services/auth/session';
import type { SessionContext, UserRole } from '@/types/auth';

export async function requireAuthenticatedSession() {
  const session = await getSessionContext();

  if (isSupabaseAuthEnabled() && (!session.isAuthenticated || !session.user)) {
    redirect('/login');
  }

  return session;
}

export async function requireActiveSession() {
  const session = await requireAuthenticatedSession();

  if (isSupabaseAuthEnabled() && session.user?.estado !== 'activo') {
    redirect('/login?error=Cuenta%20inactiva');
  }

  return session;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<SessionContext> {
  const session = await requireActiveSession();

  if (session.user && !canAccessRole(session.user.rol, allowedRoles)) {
    redirect('/dashboard');
  }

  return session;
}
