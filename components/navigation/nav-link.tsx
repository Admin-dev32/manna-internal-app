'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  label: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  compact?: boolean;
}

export function NavLink({ href, label, description, icon: Icon, compact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm transition-all',
        isActive
          ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:border-border hover:bg-white hover:text-foreground',
        compact && 'flex-col gap-1 rounded-3xl px-2 py-2 text-xs',
      )}
    >
      <span className={cn('flex size-10 items-center justify-center rounded-2xl bg-white shadow-sm', compact && 'size-9')}>
        <Icon className={cn('size-5', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      </span>
      <span className={cn('flex min-w-0 flex-1 flex-col', compact && 'items-center')}>
        <span className={cn('truncate font-medium', compact && 'max-w-[72px] text-center text-[11px] leading-tight')}>
          {label}
        </span>
        {!compact && description ? <span className="truncate text-xs text-muted-foreground">{description}</span> : null}
      </span>
      {!compact && isActive ? <Badge variant="default">Actual</Badge> : null}
    </Link>
  );
}
