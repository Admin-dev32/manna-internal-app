'use client';

import Link from 'next/link';
import { BellRing, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck } from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS } from '@/config/roles';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

interface AppHeaderProps {
  user: AppUser;
  isDemoMode: boolean;
  isSidebarCollapsed: boolean;
  themeMode: 'day' | 'night';
  onOpenMobileNav: () => void;
  onThemeModeChange: (mode: 'day' | 'night') => void;
  onToggleSidebar: () => void;
}

export function AppHeader({ user, isDemoMode, isSidebarCollapsed, themeMode, onOpenMobileNav, onThemeModeChange, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card/85 p-1 shadow-sm">
            <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegación" onClick={onOpenMobileNav}>
              <Menu className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              onClick={onToggleSidebar}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </Button>
          </div>

          <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <ShieldCheck className="size-5" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Operación interna</p>
            <h2 className="truncate text-lg font-semibold sm:text-xl">Hola, {user.nombre}</h2>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 border-border/80 bg-background/90 pl-10" placeholder="Buscar pantallas, módulos o acciones futuras..." />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center rounded-2xl border border-border/80 bg-card/85 p-1">
            <Button
              type="button"
              size="sm"
              variant={themeMode === 'day' ? 'secondary' : 'ghost'}
              className="h-8 rounded-xl px-3 text-xs"
              onClick={() => onThemeModeChange('day')}
            >
              Day
            </Button>
            <Button
              type="button"
              size="sm"
              variant={themeMode === 'night' ? 'secondary' : 'ghost'}
              className="h-8 rounded-xl px-3 text-xs"
              onClick={() => onThemeModeChange('night')}
            >
              Night
            </Button>
          </div>
          <Badge className={cn('max-w-[180px] truncate', isDemoMode ? '' : 'sm:max-w-none')} variant={isDemoMode ? 'warning' : user.estado === 'activo' ? 'success' : 'warning'}>
            {isDemoMode ? 'Modo preparación' : `${ROLE_LABELS[user.rol]} · ${user.estado}`}
          </Badge>
          <Button asChild variant="outline" size="icon" aria-label="Notificaciones" className="shrink-0 bg-card/85">
            <Link href="/notificaciones">
              <BellRing className="size-5" />
            </Link>
          </Button>
          <div className="shrink-0">
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
