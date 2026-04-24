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
const THEME_STORAGE_KEY = 'manna.theme.mode';
const WELCOME_STORAGE_KEY = 'manna.welcome.seen.v1';

type ThemeMode = 'day' | 'night';

export function AppShell({ session, children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedValue === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'night' || storedTheme === 'day') {
      setThemeMode(storedTheme);
    }
  }, []);

  useEffect(() => {
    const isNight = themeMode === 'night';
    document.documentElement.classList.toggle('dark', isNight);
    document.body.classList.toggle('dark', isNight);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!session.user) return;
    const key = `${WELCOME_STORAGE_KEY}:${session.user.id}`;
    setHasSeenWelcome(window.sessionStorage.getItem(key) === 'true');
  }, [session.user]);

  if (!session.user) {
    return <div className="page-shell">No hay sesión activa.</div>;
  }
  const currentUser = session.user;

  if (hasSeenWelcome === null) {
    return null;
  }

  if (!hasSeenWelcome) {
    const welcomeLabel = currentUser.nombre?.trim() ? `Welcome, ${currentUser.nombre}` : 'Welcome';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Manna Internal App</p>
          <h1 className="mt-3 text-3xl font-semibold">{welcomeLabel}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Before entering, confirm you are ready to start your operational session.</p>
              <button
            type="button"
            className="mt-8 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
            onClick={() => {
              window.sessionStorage.setItem(`${WELCOME_STORAGE_KEY}:${currentUser.id}`, 'true');
              setHasSeenWelcome(true);
            }}
          >
            Start Working
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar collapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)} user={currentUser} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader
            user={currentUser}
            isDemoMode={session.isDemoMode}
            isSidebarCollapsed={isSidebarCollapsed}
            themeMode={themeMode}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onThemeModeChange={setThemeMode}
            onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
          />
          <main className="flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              {session.isDemoMode ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Estás viendo la app en modo preparación. Configura Supabase Auth para activar el acceso real en {APP_CONFIG.subdomainReadyHost}.
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
      <MobileNav open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} user={currentUser} />
    </div>
  );
}
