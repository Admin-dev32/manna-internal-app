'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

import { PageContainer } from '@/components/layout/page-container';
import { PlatformDemoBanner } from '@/components/layout/platform-demo-banner';
import { PlatformWelcomeGate } from '@/components/layout/platform-welcome-gate';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { SideMegaMenu } from '@/components/navigation/side-mega-menu';
import type { SessionContext } from '@/types/auth';

import { AppHeader } from './app-header';

interface AppShellProps {
  session: SessionContext;
  children: ReactNode;
}

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
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const themeMode = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'night' || storedTheme === 'day' ? storedTheme : 'night';
    },
    () => 'night',
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
    return (
      <PlatformWelcomeGate
        user={currentUser}
        onStart={() => {
          window.sessionStorage.setItem(`${WELCOME_STORAGE_KEY}:${currentUser.id}`, 'true');
          window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
        }}
      />
    );
  }

  return (
    <div className="platform-shell lg:flex">
      <div className="hidden lg:block">
        <SideMegaMenu user={currentUser} pathname={pathname} />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppHeader
          user={currentUser}
          isDemoMode={session.isDemoMode}
          themeMode={themeMode}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onThemeModeChange={(nextMode) => {
            window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
            window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
          }}
        />
        <main className="min-h-[calc(100vh-var(--shell-header-height))] min-w-0 flex-1">
          <PageContainer size="wide" className="flex flex-col gap-6">
            {session.isDemoMode ? <PlatformDemoBanner /> : null}
            {children}
          </PageContainer>
        </main>
      </div>
      <MobileNav
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        user={currentUser}
        isDemoMode={session.isDemoMode}
        themeMode={themeMode}
        onThemeModeChange={(nextMode) => {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
          window.dispatchEvent(new Event(APP_SHELL_STORAGE_EVENT));
        }}
      />
    </div>
  );
}
