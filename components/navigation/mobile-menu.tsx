'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, X } from 'lucide-react';

import { AccountMenu } from '@/components/layout/account-menu';
import { GlobalSearchTrigger } from '@/components/layout/global-search-trigger';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/config/app';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

import {
  getActivePlatformSubmodule,
  getVisiblePlatformModules,
  getVisiblePlatformSubmodules,
  isPlatformModuleActive,
  platformNavigationIconMap,
} from './navigation-utils';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  user: AppUser | null;
  isDemoMode?: boolean;
  themeMode: 'day' | 'night';
  onThemeModeChange: (mode: 'day' | 'night') => void;
}

export function MobileMenu({ open, onClose, user, isDemoMode = false, themeMode, onThemeModeChange }: MobileMenuProps) {
  const visibleModules = getVisiblePlatformModules(user);
  const currentPath = usePathname();

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar navegación"
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex min-h-0 w-[92vw] max-w-md flex-col border-l border-shell-border bg-shell-surface shadow-shell-lg transition-transform duration-200 lg:hidden',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="border-b border-shell-border p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href="/dashboard" onClick={onClose} className="min-w-0 rounded-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Manna Snack Bars</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Plataforma interna</h2>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{APP_CONFIG.description}</p>
            </Link>
            <Button type="button" variant="outline" size="icon" aria-label="Cerrar menú" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
          <GlobalSearchTrigger className="mt-4" />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-4" aria-label="Navegación móvil">
          <div className="space-y-4">
            {visibleModules.map((module) => {
              const Icon = platformNavigationIconMap[module.icon];
              const moduleActive = isPlatformModuleActive(currentPath, module);
              const visibleSubmodules = getVisiblePlatformSubmodules(module, user);
              const activeSubmodule = getActivePlatformSubmodule(currentPath, module, user);

              return (
                <section key={module.key} className="border-b border-shell-border pb-3 last:border-b-0">
                  <Link
                    href={module.defaultHref}
                    onClick={onClose}
                    aria-current={moduleActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors',
                      moduleActive ? 'bg-shell-nav-accent/10 text-shell-nav-accent' : 'text-foreground hover:bg-shell-surface-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{module.label}</span>
                  </Link>

                  {visibleSubmodules.length > 0 ? (
                    <div className="mt-1 space-y-0.5 pl-4">
                      {visibleSubmodules.map((submodule) => {
                        const submoduleActive = activeSubmodule?.key === submodule.key;
                        const isClickable = submodule.status === 'ready' && Boolean(submodule.href);
                        const className = cn(
                          'flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                          submoduleActive
                            ? 'bg-shell-nav-accent/10 text-shell-nav-accent'
                            : 'text-muted-foreground hover:bg-shell-surface-muted hover:text-foreground',
                          !isClickable && 'cursor-not-allowed text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground/70',
                        );
                        const content = (
                          <>
                            <span className={cn('size-1.5 rounded-full', submoduleActive ? 'bg-shell-nav-accent' : 'bg-muted-foreground/40')} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{submodule.label}</span>
                            {submodule.status === 'planned' ? (
                              <span className="shrink-0 rounded-full border border-shell-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
                                Próx.
                              </span>
                            ) : null}
                          </>
                        );

                        if (!isClickable || !submodule.href) {
                          return (
                            <div key={submodule.key} className={className} aria-disabled="true" title={submodule.description}>
                              {content}
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={submodule.key}
                            href={submodule.href}
                            onClick={onClose}
                            aria-current={submoduleActive ? 'page' : undefined}
                            className={className}
                            title={submodule.description}
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </nav>

        <div className="space-y-3 border-t border-shell-border p-4">
          <ThemeToggle mode={themeMode} onChange={onThemeModeChange} className="w-full justify-center" />
          <Button asChild variant="outline" className="w-full justify-start bg-shell-surface-muted" onClick={onClose}>
            <Link href="/notificaciones">
              <BellRing className="size-4" />
              Notificaciones
            </Link>
          </Button>
          {user ? <AccountMenu user={user} isDemoMode={isDemoMode} className="w-full justify-start" /> : null}
        </div>
      </aside>
    </>
  );
}
