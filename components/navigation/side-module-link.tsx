'use client';

import Link from 'next/link';

import type { PlatformModule } from '@/config/platform-navigation';
import { cn } from '@/lib/utils';

import { platformNavigationIconMap } from './navigation-utils';

interface SideModuleLinkProps {
  module: PlatformModule;
  active: boolean;
  className?: string;
}

export function SideModuleLink({ module, active, className }: SideModuleLinkProps) {
  const Icon = platformNavigationIconMap[module.icon];

  return (
    <Link
      href={module.defaultHref}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-shell-nav-accent/10 text-shell-nav-accent'
          : 'text-muted-foreground hover:bg-shell-surface-muted hover:text-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors',
          active ? 'bg-shell-nav-accent' : 'bg-transparent',
        )}
        aria-hidden="true"
      />
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{module.label}</span>
    </Link>
  );
}
