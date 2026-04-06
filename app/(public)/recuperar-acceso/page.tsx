import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

import { RecoveryForm } from '@/components/auth/recovery-form';
import { AlertBanner } from '@/components/shared/alert-banner';
import { hasSupabaseCredentials } from '@/lib/supabase/env';

export default function RecoverAccessPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Recuperar acceso</h2>
        <p className="text-sm text-muted-foreground">
          Envía un enlace seguro de recuperación a tu correo corporativo para restablecer tu contraseña.
        </p>
      </div>

      {!hasSupabaseCredentials() ? (
        <AlertBanner
          title="Configuración pendiente"
          description="La recuperación real depende de Supabase Auth y de un redirect URL válido apuntando a esta app."
          variant="warning"
        />
      ) : null}

      <RecoveryForm />

      <div className="rounded-2xl bg-background p-4 text-sm text-muted-foreground">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <LifeBuoy className="size-4 text-primary" />
          Soporte interno
        </div>
        Si no ves el mensaje, revisa spam/promociones y confirma que tu usuario esté activo con correo autorizado del equipo interno.
      </div>

      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        Volver al acceso
      </Link>
    </div>
  );
}
