import Link from 'next/link';
import { ClipboardList, ListChecks, Mail, ShieldCheck, Users, WalletCards } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';

export default async function ConfiguracionPage() {
  const session = await requireAnyPermission(['settings.view', 'admin.users.manage']);
  const canManageUsers = Boolean(session.user && hasPermission(session.user, 'admin.users.manage'));
  const canViewAdvancedSettings = Boolean(session.user && hasPermission(session.user, 'settings.view'));
  const canViewInventoryTemplates = Boolean(session.user && (hasPermission(session.user, 'inventory.templates.view') || hasPermission(session.user, 'inventory.templates.manage')));

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Admin area</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Configuración</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Configuración administrativa</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Esta sección concentra controles sensibles. User management ya quedó operativo con protección real de permisos y owner principal.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {canManageUsers ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Lista de usuarios, edición de rol, activación y overrides por usuario.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Usa este módulo para gestionar acceso interno de forma segura sin tocar los módulos de negocio existentes.
              </p>
              <Button asChild>
                <Link href="/configuracion/usuarios">Administrar usuarios</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canViewAdvancedSettings ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div>
                  <CardTitle>Plantillas de email</CardTitle>
                  <CardDescription>Asuntos y HTML editables por propósito con placeholders seguros y preview.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crea versiones de plantilla por propósito sin tocar secretos de SMTP/Resend ni hardcodes en cada flujo.
              </p>
              <Button asChild>
                <Link href="/configuracion/plantillas-email">Administrar plantillas de email</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canViewAdvancedSettings ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <WalletCards className="size-5" />
                </div>
                <div>
                  <CardTitle>Negocio y pagos</CardTitle>
                  <CardDescription>Branding comercial y parámetros operativos no sensibles para quotes/emails/cobros.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Mantén llaves secretas en env/Vercel y administra aquí los valores operativos que sí deben editarse por negocio.
              </p>
              <Button asChild>
                <Link href="/configuracion/negocio-pagos">Administrar negocio y pagos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canViewAdvancedSettings ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <CardTitle>Plantillas operativas</CardTitle>
                  <CardDescription>Checklist, tareas y materiales base por tipo de evento.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Úsalo para reducir trabajo repetitivo al preparar eventos y dejar una base operativa reutilizable.
              </p>
              <Button asChild>
                <Link href="/configuracion/plantillas-operativas">Administrar plantillas</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canViewInventoryTemplates ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks className="size-5" />
                </div>
                <div>
                  <CardTitle>Listas maestras por barra</CardTitle>
                  <CardDescription>Materiales reutilizables para sembrar requirements en eventos reales.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta capa convive con plantillas operativas, enfocada solo en inventario reutilizable por barra.
              </p>
              <Button asChild>
                <Link href="/configuracion/listas-maestras-inventario">Administrar listas maestras</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <CardTitle>Controles globales</CardTitle>
                <CardDescription>Base existente para ajustes avanzados del sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {canViewAdvancedSettings
                ? 'Se mantiene el espacio para ajustes globales posteriores sin rehacer la arquitectura actual.'
                : 'Tu acceso actual está enfocado en gestión de usuarios; otros ajustes globales siguen reservados.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={canViewAdvancedSettings ? 'success' : 'warning'}>
                {canViewAdvancedSettings ? 'Settings habilitado' : 'Settings restringido'}
              </Badge>
              <Badge variant={canManageUsers ? 'success' : 'outline'}>User management {canManageUsers ? 'habilitado' : 'no habilitado'}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
