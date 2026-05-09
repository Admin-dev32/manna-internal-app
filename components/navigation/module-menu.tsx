'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Grid3X3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

import { getGroupedNavigationItems, isNavigationItemActive, platformNavigationIconMap } from './navigation-utils';

interface ModuleMenuProps {
  user: AppUser | null;
  className?: string;
}

export function ModuleMenu({ user, className }: ModuleMenuProps) {
  const pathname = usePathname();
  const groupedNavigation = getGroupedNavigationItems(user);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-2xl bg-shell-surface px-3 shadow-shell-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Grid3X3 className="size-4" />
        Módulos
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </Button>

      <div
        className={cn(
          'absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(75vh,42rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.5rem] border border-shell-border bg-shell-surface p-3 opacity-0 shadow-shell-lg transition',
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1',
        )}
        role="menu"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {groupedNavigation.map((group) => (
            <section key={group.section} className="rounded-2xl bg-shell-surface-muted p-3">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = platformNavigationIconMap[item.icon];
                  const active = isNavigationItemActive(pathname, item.href, item.matchPrefixes);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-shell-surface',
                      )}
                      aria-current={active ? 'page' : undefined}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl', active ? 'bg-primary/10 text-primary' : 'bg-shell-surface text-muted-foreground')}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
