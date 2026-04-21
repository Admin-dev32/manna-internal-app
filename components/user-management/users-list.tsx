import Link from 'next/link';
import { Search, ShieldCheck, UserCog } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BASE_ROLE_LABELS, OPERATIONAL_PROFILE_LABELS } from '@/config/user-access-presets';
import type { ManagedUserListItem } from '@/types/user-management';

interface UsersListProps {
  users: ManagedUserListItem[];
  searchTerm?: string;
}

export function UsersList({ users, searchTerm }: UsersListProps) {
  const activeUsers = users.filter((user) => user.is_active).length;
  const inactiveUsers = users.length - activeUsers;
  const privilegedUsers = users.filter((user) => user.role === 'owner' || user.granted_permissions.length > 0 || user.revoked_permissions.length > 0).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Admin only</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">User Management</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Gestión de usuarios internos</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Administra accesos reales del sistema: rol base, estado activo/inactivo, overrides puntuales y protección del owner principal.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Usuarios totales" value={String(users.length)} hint="Perfiles internos registrados" />
        <SummaryCard title="Usuarios activos" value={String(activeUsers)} hint={`${inactiveUsers} inactivos`} />
        <SummaryCard title="Accesos ajustados" value={String(privilegedUsers)} hint="Owners y usuarios con overrides" />
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Directorio administrativo</CardTitle>
            <CardDescription>Busca por nombre o email y entra al detalle para editar acceso.</CardDescription>
          </div>
          <form className="flex w-full max-w-xl items-center gap-3" method="get">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={searchTerm}
                placeholder="Buscar por nombre o email"
                className="flex h-11 w-full rounded-2xl border border-input bg-background pl-10 pr-4 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserCog className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No encontramos usuarios con ese filtro</h3>
              <p className="mt-2 text-sm text-muted-foreground">Prueba con otro nombre o email para continuar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acceso sensible</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const hasSensitiveAccess = user.role === 'owner' || user.granted_permissions.includes('finance.view') || user.granted_permissions.includes('admin.users.manage');

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{user.full_name ?? 'Usuario interno'}</span>
                            {user.is_site_owner ? <Badge>Site owner</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.base_role === 'owner' ? 'default' : 'secondary'}>{BASE_ROLE_LABELS[user.base_role]}</Badge>
                        <Badge className="ml-2" variant="outline">{OPERATIONAL_PROFILE_LABELS[user.operational_profile]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'success' : 'warning'}>{user.is_active ? 'Activo' : 'Inactivo'}</Badge>
                        {user.invitation_pending ? <Badge className="ml-2" variant="secondary">Invitación pendiente</Badge> : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {hasSensitiveAccess ? (
                            <Badge variant="warning">Acceso sensible</Badge>
                          ) : (
                            <Badge variant="outline">Base por rol</Badge>
                          )}
                          {user.granted_permissions.length > 0 ? <Badge variant="secondary">+{user.granted_permissions.length} grant</Badge> : null}
                          {user.revoked_permissions.length > 0 ? <Badge variant="secondary">-{user.revoked_permissions.length} revoke</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline">
                          <Link href={`/configuracion/usuarios/${user.id}`}>Editar acceso</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Controles aplicados</CardTitle>
          <CardDescription>Reglas críticas activas para reducir errores operativos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <ControlNote title="Owner protegido" description="El owner principal no puede desactivarse ni perder el rol owner desde SQL ni desde la UI." />
          <ControlNote title="Permiso dedicado" description="La administración de usuarios quedó detrás de `admin.users.manage` y no depende solo de ser manager." />
          <ControlNote title="Overrides escalables" description="Los permisos se resuelven por rol base más grants/revokes por usuario para crecer sin rehacer auth." />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ControlNote({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
