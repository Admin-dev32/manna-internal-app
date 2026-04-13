import { ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { AlertBanner } from '@/components/shared/alert-banner';
import { hasSupabaseCredentials } from '@/lib/supabase/env';

const disallowedNextPrefixes = ['/auth/', '/login', '/recuperar-acceso', '/actualizar-clave'];

function sanitizeLoginNext(value: string | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return { safeNext: undefined, wasSanitized: Boolean(value) };
  }

  if (disallowedNextPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) {
    return { safeNext: undefined, wasSanitized: true };
  }

  return { safeNext: value, wasSanitized: false };
}

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const rawNext = typeof params.next === 'string' ? params.next : undefined;
  const { safeNext, wasSanitized } = sanitizeLoginNext(rawNext);
  const error = typeof params.error === 'string' ? params.error : undefined;
  const notice = typeof params.notice === 'string' ? params.notice : undefined;

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

      {wasSanitized ? (
        <AlertBanner
          title="Ruta protegida no válida"
          description="Detectamos un destino inválido después del acceso. Inicia sesión y te llevaremos al dashboard."
          variant="warning"
        />
      ) : null}

      {notice ? (
        <AlertBanner
          title="Acceso listo"
          description={notice}
        />
      ) : null}

      <LoginForm next={safeNext} initialMessage={error} />
    </div>
  );
}
