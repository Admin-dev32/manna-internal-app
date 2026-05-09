import { APP_CONFIG } from '@/config/app';
import { cn } from '@/lib/utils';

interface PlatformDemoBannerProps {
  className?: string;
}

export function PlatformDemoBanner({ className }: PlatformDemoBannerProps) {
  return (
    <div className={cn('rounded-2xl border border-shell-border bg-shell-warning px-4 py-3 text-sm text-shell-warning-foreground shadow-shell-sm', className)}>
      Estás viendo la app en modo preparación. Configura Supabase Auth para activar el acceso real en {APP_CONFIG.subdomainReadyHost}.
    </div>
  );
}
