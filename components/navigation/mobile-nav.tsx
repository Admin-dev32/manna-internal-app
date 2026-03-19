'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import { navigationItems } from '@/config/navigation';
import { hasPermission } from '@/lib/auth/permissions';
import type { AppUser } from '@/types/auth';

import { NavLink } from './nav-link';

interface MobileNavProps {
  user: AppUser;
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ user, open, onClose }: MobileNavProps) {
  const items = navigationItems.filter((item) => hasPermission(user.rol, item.permission));

  if (!open) return null;

  return (
    <>
      <button type="button" aria-label="Cerrar navegación" className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col border-r border-border bg-background px-4 py-5 shadow-2xl lg:hidden">
        <div className="flex items-start justify-between gap-3 rounded-3xl border border-border bg-background px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Manna Snack Bars</p>
            <h2 className="mt-2 text-xl font-semibold">App interna</h2>
            <p className="mt-1 text-sm text-muted-foreground">{APP_CONFIG.description}</p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Cerrar menú" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onClose} />
          ))}
        </nav>

        <div className="mt-4 rounded-3xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Navega rápidamente entre módulos y vuelve a Leads sin depender de URLs manuales.
        </div>
      </aside>
    </>
  );
}
