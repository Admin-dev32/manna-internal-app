'use client';

import Link from 'next/link';
import { BellRing, Menu } from 'lucide-react';

import { AccountMenu } from '@/components/layout/account-menu';
import { GlobalSearchTrigger } from '@/components/layout/global-search-trigger';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import type { AppUser } from '@/types/auth';

interface AppHeaderProps {
  user: AppUser;
  isDemoMode: boolean;
  themeMode: 'day' | 'night';
  onOpenMobileNav: () => void;
  onThemeModeChange: (mode: 'day' | 'night') => void;
}

export function AppHeader({ user, isDemoMode, themeMode, onOpenMobileNav, onThemeModeChange }: AppHeaderProps) {
  return (
    <header className="platform-header-surface sticky top-0 z-30">
      <div className="flex h-shell-header w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Abrir navegación" onClick={onOpenMobileNav}>
            <Menu className="size-5" />
          </Button>

          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 rounded-xl transition hover:opacity-90 lg:hidden" aria-label="Ir al dashboard">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              MSB
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold leading-5 text-foreground">{APP_CONFIG.name}</span>
              <span className="block truncate text-xs text-muted-foreground">Control interno</span>
            </span>
          </Link>

          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-foreground">Control interno</p>
            <p className="truncate text-xs text-muted-foreground">Gestión comercial, financiera y operativa</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <GlobalSearchTrigger className="hidden w-72 2xl:flex" />
          <ThemeToggle mode={themeMode} onChange={onThemeModeChange} className="hidden md:inline-flex" />
          <Button asChild variant="outline" size="icon" aria-label="Notificaciones" className="shrink-0 bg-shell-surface shadow-shell-sm">
            <Link href="/notificaciones">
              <BellRing className="size-5" />
            </Link>
          </Button>
          <AccountMenu user={user} isDemoMode={isDemoMode} className="hidden lg:flex" />
        </div>
      </div>
    </header>
  );
}
