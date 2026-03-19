'use client';

import { BellRing, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck } from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_LABELS } from '@/config/roles';
import type { AppUser } from '@/types/auth';

interface AppHeaderProps {
  user: AppUser;
  isDemoMode: boolean;
  isSidebarCollapsed: boolean;
  onOpenMobileNav: () => void;
  onToggleSidebar: () => void;
}

export function AppHeader({ user, isDemoMode, isSidebarCollapsed, onOpenMobileNav, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="page-shell flex-row items-center justify-between gap-4 pb-4 pt-4 lg:pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button type="button" variant="outline" size="icon" className="lg:hidden" aria-label="Abrir navegación" onClick={onOpenMobileNav}>
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            onClick={onToggleSidebar}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>
          <div className="hidden size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Operación interna</p>
            <h2 className="truncate text-lg font-semibold sm:text-xl">Hola, {user.nombre}</h2>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center lg:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar pantallas, módulos o acciones futuras..." />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge variant={isDemoMode ? 'warning' : user.estado === 'activo' ? 'success' : 'warning'}>
            {isDemoMode ? 'Modo preparación' : `${ROLE_LABELS[user.rol]} · ${user.estado}`}
          </Badge>
          <Button variant="outline" size="icon" aria-label="Notificaciones">
            <BellRing className="size-5" />
          </Button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
