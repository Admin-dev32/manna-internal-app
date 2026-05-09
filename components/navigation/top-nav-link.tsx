'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavigationItem } from '@/config/navigation';
import { cn } from '@/lib/utils';

import { isNavigationItemActive, platformNavigationIconMap } from './navigation-utils';

interface TopNavLinkProps extends Pick<NavigationItem, 'href' | 'label' | 'icon' | 'matchPrefixes'> {
  className?: string;
  showIcon?: boolean;
  onNavigate?: () => void;
}

export function TopNavLink({ href, label, icon, matchPrefixes, className, showIcon = true, onNavigate }: TopNavLinkProps) {
  const pathname = usePathname();
  const isActive = isNavigationItemActive(pathname, href, matchPrefixes);
  const Icon = platformNavigationIconMap[icon];

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-medium transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-shell-surface-muted hover:text-foreground',
        className,
      )}
    >
      {showIcon ? <Icon className="size-4" /> : null}
      <span>{label}</span>
    </Link>
  );
}
