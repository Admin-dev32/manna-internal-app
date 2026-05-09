'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { LogoutButton } from '@/components/auth/logout-button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/config/roles';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

interface AccountMenuProps {
  user: AppUser;
  isDemoMode?: boolean;
  className?: string;
}

export function AccountMenu({ user, isDemoMode = false, className }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = user.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MS';

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-shell-border bg-shell-surface px-2.5 text-sm font-medium text-foreground shadow-shell-sm transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[11px] font-semibold text-primary">
          {initials}
        </span>
        <span className="hidden max-w-[8rem] truncate xl:inline">{user.nombre}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl border border-shell-border bg-shell-surface p-3 opacity-0 shadow-shell-lg transition',
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1',
        )}
        role="menu"
      >
        <div className="flex items-start gap-3 rounded-xl bg-shell-surface-muted p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Badge className="mt-2 max-w-full truncate" variant={isDemoMode ? 'warning' : user.estado === 'activo' ? 'success' : 'warning'}>
              {isDemoMode ? 'Modo preparación' : `${ROLE_LABELS[user.rol]} · ${user.estado}`}
            </Badge>
          </div>
        </div>
        <div className="mt-3" role="menuitem">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
