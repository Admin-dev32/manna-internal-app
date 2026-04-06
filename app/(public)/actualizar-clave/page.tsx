import { KeyRound } from 'lucide-react';

import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { AlertBanner } from '@/components/shared/alert-banner';

interface UpdatePasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const params = (await searchParams) ?? {};
  const callbackStatus = typeof params.status === 'string' ? params.status : null;
  const callbackMessage = typeof params.message === 'string' ? params.message : null;
  const callbackFlow = params.flow === 'invite' || params.flow === 'recovery' ? params.flow : null;

  const callbackBannerVariant = callbackStatus === 'error' || callbackStatus === 'warning' ? 'warning' : 'info';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </div>
        <h2 className="text-2xl font-semibold">Actualizar contraseña</h2>
        <p className="text-sm text-muted-foreground">
          {callbackFlow === 'invite'
            ? 'Estás configurando tu acceso por primera vez. Define una contraseña segura para entrar a la app interna.'
            : 'Define una nueva contraseña para tu cuenta usando el enlace seguro enviado a tu correo.'}
        </p>
      </div>

      <AlertBanner
        title="Sesión temporal de recuperación"
        description={
          callbackMessage ??
          'Esta pantalla funciona después de abrir el enlace enviado por Supabase Auth y mantiene la experiencia dentro de la misma shell pública.'
        }
        variant={callbackBannerVariant}
      />

      <UpdatePasswordForm flow={callbackFlow} />
    </div>
  );
}
