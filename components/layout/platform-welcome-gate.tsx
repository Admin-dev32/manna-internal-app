'use client';

import type { AppUser } from '@/types/auth';

interface PlatformWelcomeGateProps {
  user: AppUser;
  onStart: () => void;
}

export function PlatformWelcomeGate({ user, onStart }: PlatformWelcomeGateProps) {
  const welcomeLabel = user.nombre?.trim() ? `Bienvenido, ${user.nombre}` : 'Bienvenido';

  return (
    <div className="flex min-h-screen items-center justify-center bg-shell-canvas px-6 text-foreground">
      <div className="w-full max-w-xl rounded-[2rem] border border-shell-border bg-shell-surface p-8 text-center shadow-shell-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Manna Internal App</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{welcomeLabel}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Confirma que estás listo para iniciar tu sesión operativa interna.
        </p>
        <button
          type="button"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-shell-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onStart}
        >
          Entrar a la plataforma
        </button>
      </div>
    </div>
  );
}
