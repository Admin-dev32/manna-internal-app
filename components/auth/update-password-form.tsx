'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { KeySquare } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Input } from '@/components/ui/input';
import { updatePasswordAction } from '@/services/auth/actions';
import { initialAuthActionState } from '@/services/auth/auth-action-state';

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialAuthActionState);

  return (
    <form className="space-y-4" action={formAction}>
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
      <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
        Volver al acceso
      </Link>
    </form>
  );
}
