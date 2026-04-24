'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
  title = 'Command palette',
  items,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: CommandPaletteItem[];
}) {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.label} ${item.hint ?? ''} ${(item.keywords ?? []).join(' ')}`.toLowerCase().includes(normalized));
  }, [items, query]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" aria-label="Cerrar command palette" onClick={onClose} />
      <div className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-2xl -translate-x-1/2 rounded-3xl border border-border bg-background shadow-2xl">
        <div className="border-b border-border p-4">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" placeholder="Buscar acción o atajo..." />
          </div>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="rounded-2xl p-4 text-sm text-muted-foreground">No hay acciones para esa búsqueda.</p>
          ) : (
            filteredItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between rounded-2xl px-3 py-3 text-left"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <span>{item.label}</span>
                {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
              </Button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
