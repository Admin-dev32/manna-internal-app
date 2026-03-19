'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { MobileNav } from '@/components/navigation/mobile-nav';
import { Sidebar } from '@/components/navigation/sidebar';
import { APP_CONFIG } from '@/config/app';
import type { SessionContext } from '@/types/auth';

import { AppHeader } from './app-header';

interface AppShellProps {
  session: SessionContext;
  children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'manna.sidebar.collapsed';

export function AppShell({ session, children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedValue === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  if (!session.user) {
    return <div className="page-shell">No hay sesión activa.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar user={session.user} collapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader
            user={session.user}
            isDemoMode={session.isDemoMode}
            isSidebarCollapsed={isSidebarCollapsed}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
          />
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
      <MobileNav user={session.user} open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
    </div>
  );
}
