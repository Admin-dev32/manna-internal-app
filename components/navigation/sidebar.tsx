'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import { navigationItems } from '@/config/navigation';
import { hasPermission } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

import { NavLink } from './nav-link';

interface SidebarProps {
  user: AppUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ user, collapsed, onToggleCollapse }: SidebarProps) {
  const availableItems = navigationItems.filter((item) => hasPermission(user.rol, item.permission));

  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 border-r border-border bg-white/80 px-4 py-5 backdrop-blur transition-[width,padding] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col',
        collapsed ? 'w-24 px-3' : 'w-72',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href="/dashboard" className={cn('rounded-3xl border border-border bg-background px-4 py-4 transition-all', collapsed && 'px-3 py-3')}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">MSB</p>
          {!collapsed ? (
            <>
              <h1 className="mt-2 text-xl font-semibold">App interna</h1>
              <p className="mt-1 text-sm text-muted-foreground">{APP_CONFIG.description}</p>
            </>
          ) : null}
        </Link>
        <Button type="button" variant="outline" size="icon" aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'} onClick={onToggleCollapse}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {availableItems.map((item) => (
          <NavLink key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
