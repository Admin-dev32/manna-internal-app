'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import { navigationItems } from '@/config/navigation';
import { hasPermission } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

import { NavLink } from './nav-link';

interface MobileNavProps {
  user: AppUser;
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ user, open, onClose }: MobileNavProps) {
  const items = navigationItems.filter((item) => hasPermission(user.rol, item.permission));

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar navegación"
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col border-r border-border bg-background px-4 py-4 shadow-2xl transition-transform duration-200 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between gap-3 rounded-[28px] border border-border bg-background/95 px-4 py-4 shadow-sm">
          <Link href="/dashboard" onClick={onClose} className="min-w-0 flex-1 rounded-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Manna Snack Bars</p>
            <h2 className="mt-2 text-xl font-semibold">App interna</h2>
            <p className="mt-1 text-sm text-muted-foreground">{APP_CONFIG.description}</p>
          </Link>
          <Button type="button" variant="outline" size="icon" aria-label="Cerrar menú" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Accede aquí a las áreas realmente operativas. Clientes y reservas iniciales viven dentro del flujo de cotizaciones aceptadas.
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-2 overflow-y-auto pb-4" aria-label="Navegación móvil">
          {items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onClose} />
          ))}
        </nav>
      </aside>
    </>
  );
}
