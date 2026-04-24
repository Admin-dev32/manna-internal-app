import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function OpsTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('ops-table-shell space-y-4 p-4 sm:p-5', className)}>{children}</section>;
}

export function OpsTableToolbar({
  searchSlot,
  filtersSlot,
  actionsSlot,
  metaSlot,
}: {
  searchSlot?: ReactNode;
  filtersSlot?: ReactNode;
  actionsSlot?: ReactNode;
  metaSlot?: ReactNode;
}) {
  return (
    <div className="space-y-3 border-b border-border/70 pb-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">{searchSlot}</div>
        <div className="flex flex-wrap gap-2">{actionsSlot}</div>
      </div>
      {metaSlot ? <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{metaSlot}</div> : null}
      {filtersSlot ? <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">{filtersSlot}</div> : null}
    </div>
  );
}

export function OpsTableState({
  kind,
  title,
  description,
}: {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description: string;
}) {
  const tone = kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-dashed border-border bg-muted/20 text-muted-foreground';
  return (
    <div className={cn('rounded-2xl border p-5 text-sm', tone)}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}

export function OpsRowSelectionBar({
  selectedCount,
  children,
}: {
  selectedCount: number;
  children?: ReactNode;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2">
      <p className="text-sm font-medium text-primary">{selectedCount} elemento(s) seleccionado(s)</p>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
