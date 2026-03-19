import { ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { AlertBanner } from '@/components/shared/alert-banner';
import { hasSupabaseCredentials } from '@/lib/supabase/env';

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const next = typeof params.next === 'string' ? params.next : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <h2 className="text-2xl font-semibold">Acceso interno</h2>
        <p className="text-sm text-muted-foreground">
          Inicia sesión con tu correo y contraseña para entrar al entorno interno de Manna Snack Bars.
        </p>
      </div>

      {!hasSupabaseCredentials() ? (
        <AlertBanner
          title="Configuración pendiente"
          description="No se detectaron credenciales de Supabase en el entorno. La interfaz está lista, pero el login real requiere configurar las variables indicadas en .env.example."
          variant="warning"
        />
      ) : null}

      <LoginForm next={next} initialMessage={error} />
    </div>
  );
}
