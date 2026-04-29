'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';

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
const APP_SHELL_STORAGE_EVENT = 'manna:app-shell-storage-change';

function subscribeStorage(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener(APP_SHELL_STORAGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(APP_SHELL_STORAGE_EVENT, handler);
  };
}

export function AppShell({ session, children }: AppShellProps) {
  const isSidebarCollapsed = useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
    () => false,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const themeMode = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'night' || storedTheme === 'day' ? storedTheme : 'day';
    },
    () => 'day',
  );
  const hasSeenWelcome = useSyncExternalStore(
    subscribeStorage,
    () => {
      if (!session.user) return null;
      return window.sessionStorage.getItem(`${WELCOME_STORAGE_KEY}:${session.user.id}`) === 'true';
    },
    () => null,
  );

  useEffect(() => {
    const isNight = themeMode === 'night';
    document.documentElement.classList.toggle('dark', isNight);
    document.body.classList.toggle('dark', isNight);
  }, [themeMode]);

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
              window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
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
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!isSidebarCollapsed));
            window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
          }}
          user={currentUser}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader
            user={currentUser}
            isDemoMode={session.isDemoMode}
            isSidebarCollapsed={isSidebarCollapsed}
            themeMode={themeMode}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onThemeModeChange={(nextMode) => {
              window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
              window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
            }}
            onToggleSidebar={() => {
              window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!isSidebarCollapsed));
              window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
            }}
          />
          <main className="flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              {session.isDemoMode ? (
                <div className="rounded-3xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
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
