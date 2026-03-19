'use client';

import { navigationItems } from '@/config/navigation';
import { hasPermission } from '@/lib/auth/permissions';
import type { AppUser } from '@/types/auth';

import { NavLink } from './nav-link';

interface MobileNavProps {
  user: AppUser;
}

export function MobileNav({ user }: MobileNavProps) {
  const items = navigationItems.filter((item) => hasPermission(user.rol, item.permission)).slice(0, 5);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
      <nav className="grid grid-cols-5 gap-2">
        {items.map((item) => (
          <NavLink key={item.href} {...item} compact />
        ))}
      </nav>
    </div>
  );
}
