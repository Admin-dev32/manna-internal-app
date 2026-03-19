import Link from 'next/link';

import { navigationItems } from '@/config/navigation';
import { APP_CONFIG } from '@/config/app';
import { hasPermission } from '@/lib/auth/permissions';
import type { AppUser } from '@/types/auth';

import { NavLink } from './nav-link';

interface SidebarProps {
  user: AppUser;
}

export function Sidebar({ user }: SidebarProps) {
  const availableItems = navigationItems.filter((item) => hasPermission(user.rol, item.permission));

  return (
    <aside className="hidden h-screen w-72 shrink-0 border-r border-border bg-white/80 px-4 py-5 backdrop-blur lg:sticky lg:top-0 lg:flex lg:flex-col">
      <Link href="/dashboard" className="rounded-3xl border border-border bg-background px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Manna Snack Bars</p>
        <h1 className="mt-2 text-xl font-semibold">App interna</h1>
        <p className="mt-1 text-sm text-muted-foreground">{APP_CONFIG.description}</p>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {availableItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
