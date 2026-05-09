'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ThemeMode = 'day' | 'night';

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  className?: string;
}

export function ThemeToggle({ mode, onChange, className }: ThemeToggleProps) {
  return (
    <div className={cn('inline-flex items-center rounded-2xl border border-shell-border bg-shell-surface-muted p-1', className)} aria-label="Selector de tema">
      <Button
        type="button"
        size="sm"
        variant={mode === 'day' ? 'secondary' : 'ghost'}
        className="h-8 rounded-xl px-3 text-xs"
        onClick={() => onChange('day')}
      >
        Día
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'night' ? 'secondary' : 'ghost'}
        className="h-8 rounded-xl px-3 text-xs"
        onClick={() => onChange('night')}
      >
        Noche
      </Button>
    </div>
  );
}
