import type { ReactNode } from 'react';

import { AppBreadcrumbs, type BreadcrumbItem } from '@/components/layout/app-breadcrumbs';
import { cn } from '@/lib/utils';

interface ModulePageLayoutProps {
  badge?: string;
  title: string;
  description: string;
  breadcrumbs?: BreadcrumbItem[];
  headerActions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function ModulePageLayout({
  badge,
  title,
  description,
  breadcrumbs = [],
  headerActions,
  children,
  aside,
  className,
}: ModulePageLayoutProps) {
  return (
    <div className={cn('module-page space-y-6', className)}>
      <section className="module-page-header">
        <div className="space-y-3">
          <AppBreadcrumbs items={breadcrumbs} />
          {badge ? <p className="module-page-badge">{badge}</p> : null}
          <div className="space-y-2">
            <h1 className="module-page-title">{title}</h1>
            <p className="max-w-3xl text-sm text-slate-300 sm:text-base">{description}</p>
          </div>
        </div>
        {headerActions ? <div className="flex flex-wrap items-center gap-3">{headerActions}</div> : null}
      </section>

      {aside ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">{children}</div>
          <aside className="space-y-6">{aside}</aside>
        </div>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  );
}
