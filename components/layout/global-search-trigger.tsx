'use client';

import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

interface GlobalSearchTriggerProps {
  className?: string;
  onOpen?: () => void;
}

export function GlobalSearchTrigger({ className, onOpen }: GlobalSearchTriggerProps) {
  const isEnabled = Boolean(onOpen);

  return (
    <button
      type="button"
      disabled={!isEnabled}
      aria-disabled={!isEnabled}
      title={isEnabled ? 'Buscar pantallas, módulos o acciones' : 'Búsqueda global próximamente'}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-3 rounded-2xl border border-shell-border bg-shell-surface px-3 text-left text-sm text-muted-foreground shadow-shell-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isEnabled
          ? 'hover:border-shell-nav-accent/40 hover:text-foreground'
          : 'h-9 rounded-xl bg-shell-surface-muted text-xs shadow-none opacity-70 cursor-not-allowed',
        className,
      )}
      onClick={onOpen}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0" />
        <span className="truncate">Buscar pantallas, módulos o acciones</span>
      </span>
      <span className="hidden rounded-lg border border-shell-border bg-shell-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
        {isEnabled ? '⌘K' : 'Próximamente'}
      </span>
    </button>
  );
}
