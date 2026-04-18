'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeySquare } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Input } from '@/components/ui/input';
import { updatePasswordAction } from '@/services/auth/actions';
import { initialAuthActionState } from '@/services/auth/auth-action-state';

interface UpdatePasswordFormProps {
  flow: 'invite' | 'recovery' | null;
}

export function UpdatePasswordForm({ flow }: UpdatePasswordFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(updatePasswordAction, initialAuthActionState);

  useEffect(() => {
    if (state.status !== 'success') return;

    const timeoutId = window.setTimeout(() => {
      const notice = flow === 'invite'
        ? 'Acceso inicial configurado. Inicia sesión con tu nueva clave.'
        : 'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.';

      router.replace(`/login?notice=${encodeURIComponent(notice)}`);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [router, state.status]);

  return (
    <form className="space-y-4" action={formAction}>
      {flow ? <input type="hidden" name="flow" value={flow} /> : null}
      <AuthFeedback state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Nueva contraseña
        </label>
        <div className="relative">
          <KeySquare className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" name="password" type="password" autoComplete="new-password" className="pl-10" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          Confirmar contraseña
        </label>
        <div className="relative">
          <KeySquare className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="pl-10"
          />
        </div>
      </div>
      <AuthSubmitButton idleLabel="Actualizar contraseña" loadingLabel="Actualizando..." />
      {state.status === 'success' ? (
        <p className="text-center text-sm text-muted-foreground">
          {flow === 'invite'
            ? 'Tu acceso inicial quedó listo. Te llevaremos al inicio de sesión…'
            : 'Te llevaremos al acceso en unos segundos…'}
        </p>
      ) : null}
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Volver al acceso
      </Link>
    </form>
  );
}
