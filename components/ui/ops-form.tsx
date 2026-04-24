import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function OpsFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <header className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function OpsFormStickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>
    </div>
  );
}
