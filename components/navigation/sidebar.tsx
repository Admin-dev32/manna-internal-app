'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import { mainNavigationItems } from '@/config/navigation';
import { cn } from '@/lib/utils';

import { NavLink } from './nav-link';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden h-screen min-h-0 shrink-0 border-r border-border/80 bg-white/88 backdrop-blur transition-[width,padding] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col',
        collapsed ? 'w-24 px-3 py-4' : 'w-80 px-4 py-5',
      )}
    >
      <div className={cn('flex items-center gap-3 rounded-[28px] border border-border/80 bg-background/95 shadow-sm', collapsed ? 'flex-col px-2 py-3' : 'px-4 py-4')}>
        <Link
          href="/dashboard"
          aria-label="Ir al dashboard"
          className={cn(
            'group flex min-w-0 flex-1 items-center rounded-3xl transition-colors hover:bg-accent/60',
            collapsed ? 'justify-center px-0 py-1' : 'gap-3 px-1 py-1',
          )}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold uppercase tracking-[0.3em] text-primary shadow-sm">
            MSB
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">App interna</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{APP_CONFIG.description}</span>
            </span>
          ) : null}
        </Link>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <div className={cn('mt-5 flex items-center', collapsed ? 'justify-center px-1' : 'justify-between px-2')}>
        {!collapsed ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Flujo activo</p> : null}
      </div>

      <nav className={cn('mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-3', collapsed ? 'px-1' : 'pr-1')} aria-label="Navegación principal">
        {mainNavigationItems.map((item) => (
          <NavLink key={item.href} {...item} description={undefined} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
