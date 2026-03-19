import { KeyRound } from 'lucide-react';

import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { AlertBanner } from '@/components/shared/alert-banner';

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </div>
        <h2 className="text-2xl font-semibold">Actualizar contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Define una nueva contraseña para tu cuenta usando el enlace seguro enviado a tu correo.
        </p>
      </div>

      <AlertBanner
        title="Sesión temporal de recuperación"
        description="Esta pantalla funciona después de abrir el enlace enviado por Supabase Auth y mantiene la experiencia dentro de la misma shell pública."
      />

      <UpdatePasswordForm />
    </div>
  );
}
