'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DrawerTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  badge?: ReactNode;
  title: string;
  subtitle?: string;
  headerMeta?: ReactNode;
  headerActions?: ReactNode;
  tabs: DrawerTab[];
  activeTab: string;
  onChangeTab: (tabId: string) => void;
}

export function DetailDrawer({
  open,
  onClose,
  badge,
  title,
  subtitle,
  headerMeta,
  headerActions,
  tabs,
  activeTab,
  onChangeTab,
}: DetailDrawerProps) {
  if (!open) return null;
  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <>
      <button type="button" aria-label="Cerrar panel" className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                {badge}
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
                  {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
                </div>
                {headerMeta}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button key={tab.id} type="button" size="sm" variant={tab.id === selectedTab.id ? 'default' : 'outline'} onClick={() => onChangeTab(tab.id)}>
                  {tab.label}
                </Button>
              ))}
            </div>

            {headerActions ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}
          </div>
        </div>

        <div className={cn('space-y-6 p-5')}>{selectedTab.content}</div>
      </aside>
    </>
  );
}
