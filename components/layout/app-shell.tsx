import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/config/app';
import type { SessionContext } from '@/types/auth';

import { AppHeader } from './app-header';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { Sidebar } from '@/components/navigation/sidebar';

interface AppShellProps {
  session: SessionContext;
  children: ReactNode;
}

export function AppShell({ session, children }: AppShellProps) {
  if (!session.user) {
    return <div className="page-shell">No hay sesión activa.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar user={session.user} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader user={session.user} isDemoMode={session.isDemoMode} />
          <main className="page-shell flex-1 pt-6">
            {session.isDemoMode ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Estás viendo la app en modo preparación. Configura Supabase Auth para activar el acceso real en {APP_CONFIG.subdomainReadyHost}.
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
      <MobileNav user={session.user} />
    </div>
  );
}
