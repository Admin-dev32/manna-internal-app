'use client';

import Link from 'next/link';
import { Circle } from 'lucide-react';

import type { PlatformSubmodule } from '@/config/platform-navigation';
import { cn } from '@/lib/utils';

interface SideSubmoduleLinkProps {
  submodule: PlatformSubmodule;
  active: boolean;
  className?: string;
}

export function SideSubmoduleLink({ submodule, active, className }: SideSubmoduleLinkProps) {
  const isClickable = submodule.status === 'ready' && Boolean(submodule.href);
  const baseClassName = cn(
    'group relative flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active
      ? 'bg-shell-nav-accent/10 text-shell-nav-accent'
      : 'text-muted-foreground hover:bg-shell-surface-muted hover:text-foreground',
    !isClickable && 'cursor-not-allowed text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground/70',
    className,
  );
  const content = (
    <>
      <Circle className={cn('size-1.5 shrink-0 fill-current', active ? 'text-shell-nav-accent' : 'text-muted-foreground/50')} aria-hidden="true" />
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
      <div className={baseClassName} aria-disabled="true" title={submodule.description}>
        {content}
      </div>
    );
  }

  return (
    <Link href={submodule.href} aria-current={active ? 'page' : undefined} className={baseClassName} title={submodule.description}>
      {content}
    </Link>
  );
}
