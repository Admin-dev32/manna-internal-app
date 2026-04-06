'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Input } from '@/components/ui/input';
import { recoverAccessAction } from '@/services/auth/actions';
import { initialAuthActionState } from '@/services/auth/auth-action-state';

export function RecoveryForm() {
  const [state, formAction] = useActionState(recoverAccessAction, initialAuthActionState);

  return (
    <form className="space-y-4" action={formAction}>
      <AuthFeedback state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="recovery-email">
          Correo de acceso
        </label>
        <div className="relative">
          <MailCheck className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            maxLength={120}
            placeholder="nombre@manna.com"
            className="pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">Usa el mismo correo con el que accedes a la app interna.</p>
      </div>
      <AuthSubmitButton idleLabel="Enviar enlace de recuperación" loadingLabel="Enviando enlace..." />
    </form>
  );
}
