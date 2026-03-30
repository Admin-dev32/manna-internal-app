import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
}

export function EmptyState({ icon, title, description, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-5 p-6 sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {primaryAction ? <Button>{primaryAction}</Button> : null}
          {secondaryAction ? <Button variant="outline">{secondaryAction}</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}
