import type { Route } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: Route;
}

export function AppBreadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link href={item.href} className="rounded-md px-1 py-0.5 hover:bg-accent/70 hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'font-medium text-foreground' : '')}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="size-3.5" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
