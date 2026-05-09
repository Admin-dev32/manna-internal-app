'use client';

import Link from 'next/link';

import { APP_CONFIG } from '@/config/app';
import type { PlatformModule } from '@/config/platform-navigation';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';

import {
  getActivePlatformModule,
  getVisiblePlatformModules,
  getActivePlatformSubmodule,
  getVisiblePlatformSubmodules,
  isPlatformModuleActive,
} from './navigation-utils';
import { SideModuleLink } from './side-module-link';
import { SideSubmoduleLink } from './side-submodule-link';

interface SideMegaMenuProps {
  user: AppUser | null;
  pathname: string;
  className?: string;
}

function getSubmodulePanelModule(pathname: string, user: AppUser | null, visibleModules: PlatformModule[]) {
  return getActivePlatformModule(pathname, user) ?? visibleModules[0] ?? null;
}

export function SideMegaMenu({ user, pathname, className }: SideMegaMenuProps) {
  const visibleModules = getVisiblePlatformModules(user);
  const activeModule = getSubmodulePanelModule(pathname, user, visibleModules);
  const visibleSubmodules = activeModule ? getVisiblePlatformSubmodules(activeModule, user) : [];
  const activeSubmodule = activeModule ? getActivePlatformSubmodule(pathname, activeModule, user) : null;

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-shell-border bg-shell-surface text-foreground shadow-shell-sm',
        className,
      )}
      aria-label="Navegación de plataforma"
    >
      <div className="border-b border-shell-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg text-foreground transition hover:text-primary" aria-label="Ir al dashboard">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            MSB
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-5">{APP_CONFIG.name}</span>
            <span className="block truncate text-xs text-muted-foreground">Control interno</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Módulos principales">
        <div className="space-y-5">
          <section className="space-y-1">
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Módulos</p>
            <div className="mt-2 space-y-0.5">
              {visibleModules.map((module) => (
                <SideModuleLink key={module.key} module={module} active={isPlatformModuleActive(pathname, module)} />
              ))}
            </div>
          </section>

          {activeModule ? (
            <section className="space-y-1 border-t border-shell-border pt-4" aria-label={`Submódulos de ${activeModule.label}`}>
              <div className="flex items-center justify-between gap-2 px-2.5">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{activeModule.label}</p>
                <span className="h-px flex-1 bg-shell-border" aria-hidden="true" />
              </div>
              <div className="mt-2 space-y-0.5">
                {visibleSubmodules.length > 0 ? (
                  visibleSubmodules.map((submodule) => (
                    <SideSubmoduleLink
                      key={submodule.key}
                      submodule={submodule}
                      active={activeSubmodule?.key === submodule.key}
                    />
                  ))
                ) : (
                  <p className="rounded-md px-2.5 py-2 text-xs text-muted-foreground">No hay submódulos disponibles para tu usuario.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
