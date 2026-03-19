'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { KeyRound, Mail } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { AuthSubmitButton } from '@/components/auth/auth-submit-button';
import { Input } from '@/components/ui/input';
import { loginAction } from '@/services/auth/actions';
import { initialAuthActionState } from '@/services/auth/auth-action-state';

interface LoginFormProps {
  next?: string;
  initialMessage?: string;
}

export function LoginForm({ next, initialMessage }: LoginFormProps) {
  const initialState = initialMessage
    ? { status: 'error' as const, message: initialMessage }
    : initialAuthActionState;

  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form className="space-y-4" action={formAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthFeedback state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Correo corporativo
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@manna.com" className="pl-10" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-10"
          />
        </div>
      </div>
      <AuthSubmitButton idleLabel="Entrar" loadingLabel="Validando acceso..." />
      <div className="flex items-center justify-between gap-4 text-sm">
        <Link href="/recuperar-acceso" className="font-medium text-primary hover:underline">
          Olvidé mi acceso
        </Link>
        <span className="text-muted-foreground">Acceso solo para personal autorizado</span>
      </div>
    </form>
  );
}
