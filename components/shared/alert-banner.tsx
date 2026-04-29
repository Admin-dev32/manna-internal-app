import { AlertCircle, Rocket } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AlertBannerProps {
  title: string;
  description: string;
  variant?: 'info' | 'warning';
}

export function AlertBanner({ title, description, variant = 'info' }: AlertBannerProps) {
  const Icon = variant === 'warning' ? AlertCircle : Rocket;

  return (
    <Card
      className={cn(
        'border-dashed',
        variant === 'warning' ? 'border-border bg-muted' : 'border-primary/20 bg-primary/5',
      )}
    >
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl',
            variant === 'warning' ? 'bg-background text-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            <Badge variant={variant === 'warning' ? 'warning' : 'success'}>
              {variant === 'warning' ? 'Preparación' : 'Base lista'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
