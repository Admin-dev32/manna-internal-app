'use client';

import { useActionState, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS, USER_MANAGEMENT_OVERRIDE_OPTIONS } from '@/config/permissions';
import { ROLE_LABELS } from '@/config/roles';
import { getRolePermissions } from '@/lib/auth/permissions';
import { initialUserManagementActionState } from '@/services/user-management/form-state';
import { deletePendingManagedUserAction, resendManagedUserInviteAction, updateManagedUserAction } from '@/services/user-management/actions';
import { PERMISSION_KEYS, type PermissionKey } from '@/types/auth';
import type { ManagedUserDetail } from '@/types/user-management';

interface UserAccessFormProps {
  user: ManagedUserDetail;
}

export function UserAccessForm({ user }: UserAccessFormProps) {
  const [state, formAction] = useActionState(updateManagedUserAction.bind(null, user.id), initialUserManagementActionState);
  const [resendState, resendAction] = useActionState(resendManagedUserInviteAction.bind(null, user.id), initialUserManagementActionState);
  const [deleteState, deleteAction] = useActionState(deletePendingManagedUserAction.bind(null, user.id), initialUserManagementActionState);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [grantedPermissions, setGrantedPermissions] = useState<PermissionKey[]>(user.granted_permissions);
  const [revokedPermissions, setRevokedPermissions] = useState<PermissionKey[]>(user.revoked_permissions);
  const isProtectedOwner = user.is_site_owner;
  const canEditRole = !isProtectedOwner;
  const canEditStatus = !isProtectedOwner;
  const canEditOverrides = selectedRole !== 'owner' && !isProtectedOwner;
  const rolePermissions = useMemo(() => getRolePermissions(selectedRole), [selectedRole]);
  const effectivePermissionSet = useMemo(() => {
    if (isProtectedOwner || selectedRole === 'owner') {
      return new Set(PERMISSION_KEYS);
    }

    const effective = new Set(rolePermissions);

    grantedPermissions.forEach((permission) => {
      effective.add(permission);
    });

    revokedPermissions.forEach((permission) => {
      effective.delete(permission);
    });

    return effective;
  }, [grantedPermissions, isProtectedOwner, revokedPermissions, rolePermissions, selectedRole]);

  function addGrantedPermission(permission: PermissionKey) {
    if (!canEditOverrides) return;
    setGrantedPermissions((current) => (current.includes(permission) ? current : [...current, permission]));
    setRevokedPermissions((current) => current.filter((item) => item !== permission));
  }

  function addRevokedPermission(permission: PermissionKey) {
    if (!canEditOverrides) return;
    setRevokedPermissions((current) => (current.includes(permission) ? current : [...current, permission]));
    setGrantedPermissions((current) => current.filter((item) => item !== permission));
  }

  function removeGrantedPermission(permission: PermissionKey) {
    if (!canEditOverrides) return;
    setGrantedPermissions((current) => current.filter((item) => item !== permission));
  }

  function removeRevokedPermission(permission: PermissionKey) {
    if (!canEditOverrides) return;
    setRevokedPermissions((current) => current.filter((item) => item !== permission));
  }

  return (
    <form action={formAction} className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Admin only</Badge>
          {user.is_site_owner ? <Badge className="bg-white/10 text-white hover:bg-white/10">Site owner protegido</Badge> : null}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{user.full_name ?? 'Usuario interno'}</h1>
          <p className="text-sm text-slate-300 sm:text-base">{user.email}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={user.is_active ? 'success' : 'warning'}>{user.is_active ? 'Activo' : 'Inactivo'}</Badge>
            {user.invitation_pending ? <Badge variant="secondary">Invitación pendiente</Badge> : null}
            {user.last_sign_in_at ? <Badge variant="outline">Ya ingresó a la app</Badge> : null}
          </div>
        </div>
      </section>

      {state.status !== 'idle' ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {state.message}
        </div>
      ) : null}
      {resendState.status !== 'idle' ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${resendState.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {resendState.message}
        </div>
      ) : null}
      {deleteState.status !== 'idle' ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${deleteState.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {deleteState.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Acceso base del usuario</CardTitle>
              <CardDescription>Define el rol principal y el estado general de acceso a la app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="role">
                    Rol base
                  </label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={user.role}
                    onChange={(event) => setSelectedRole(event.target.value as typeof user.role)}
                    disabled={!canEditRole}
                    className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</p>
                  <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <input type="checkbox" name="is_active" defaultChecked={user.is_active} disabled={!canEditStatus} className="size-4 rounded border-border" />
                    Usuario activo
                  </label>
                  <p className="text-sm text-muted-foreground">Cuando está inactivo, el usuario no puede usar la app aunque siga existiendo en auth.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBox label="Role actual" value={ROLE_LABELS[user.role]} />
                <InfoBox label="Permisos efectivos" value={`${user.effective_permissions.length} permisos`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overrides de permisos</CardTitle>
              <CardDescription>Se aplican encima del rol base. Usa grants para ampliar y revokes para restringir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!canEditOverrides ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {isProtectedOwner
                    ? 'El site owner principal no admite overrides para evitar lockout y configuraciones ambiguas.'
                    : 'Los usuarios con rol owner ya tienen full access y no necesitan overrides manuales.'}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <PermissionColumn
                  title="Permisos adicionales"
                  description="Otorga acceso extra sobre el rol base."
                  selectedPermissions={grantedPermissions}
                  disabled={!canEditOverrides}
                  onAdd={addGrantedPermission}
                  onRemove={removeGrantedPermission}
                />
                <PermissionColumn
                  title="Permisos restringidos"
                  description="Quita acceso aunque el rol base lo incluya."
                  selectedPermissions={revokedPermissions}
                  disabled={!canEditOverrides}
                  onAdd={addRevokedPermission}
                  onRemove={removeRevokedPermission}
                />
              </div>

              {grantedPermissions.map((permission) => (
                <input key={`granted-hidden-${permission}`} type="hidden" name="granted_permissions" value={permission} />
              ))}
              {revokedPermissions.map((permission) => (
                <input key={`revoked-hidden-${permission}`} type="hidden" name="revoked_permissions" value={permission} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contexto administrativo</CardTitle>
              <CardDescription>Referencia operativa para soporte y control interno.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input defaultValue={user.email} disabled aria-label="Email del usuario" />
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="full_name">
                  Nombre completo
                </label>
                <Input id="full_name" name="full_name" defaultValue={user.full_name ?? ''} maxLength={120} placeholder="Nombre del usuario" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={user.is_active ? 'success' : 'warning'}>{user.is_active ? 'Activo' : 'Inactivo'}</Badge>
                <Badge variant={user.role === 'owner' ? 'default' : 'secondary'}>{ROLE_LABELS[user.role]}</Badge>
                {user.is_site_owner ? <Badge>Site owner</Badge> : null}
                {user.invitation_pending ? <Badge variant="secondary">Pendiente de primer acceso</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {user.last_sign_in_at
                  ? `Último acceso: ${new Date(user.last_sign_in_at).toLocaleString('es-MX')}`
                  : 'Sin primer acceso registrado todavía.'}
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="admin_notes">
                  Notas administrativas
                </label>
                <Textarea
                  id="admin_notes"
                  name="admin_notes"
                  defaultValue={user.admin_notes ?? ''}
                  rows={6}
                  placeholder="Notas internas opcionales para contexto administrativo"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Protecciones activas</CardTitle>
              <CardDescription>Guardrails para no romper el acceso administrativo del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProtectionRow
                icon={user.is_site_owner ? ShieldAlert : ShieldCheck}
                title="Owner principal protegido"
                description={user.is_site_owner ? 'No puede desactivarse, perder owner ni recibir overrides desde backend/SQL.' : 'No aplica protección de site owner para este usuario.'}
              />
              <ProtectionRow
                icon={ShieldCheck}
                title="Resolución de permisos"
                description="Prioridad: owner protegido => full access. Si no, rol base + grants explícitos - revokes explícitos."
              />
              <ProtectionRow
                icon={ShieldCheck}
                title="Acceso admin"
                description="Solo usuarios con `admin.users.manage` pueden listar o editar otros usuarios."
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit">Guardar cambios</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ciclo de vida del usuario</CardTitle>
          <CardDescription>Acciones rápidas para invitaciones pendientes y limpieza segura de altas incompletas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <form action={resendAction}>
            <Button type="submit" variant="outline" disabled={!user.can_resend_invitation}>
              Reenviar invitación
            </Button>
          </form>
          <form action={deleteAction}>
            <Button type="submit" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={!user.can_delete_user}>
              Eliminar usuario pendiente
            </Button>
          </form>
          {!user.can_resend_invitation ? (
            <p className="w-full text-xs text-muted-foreground">Solo disponible para usuarios invitados pendientes sin primer acceso.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permisos efectivos por usuario</CardTitle>
          <CardDescription>Vista clara de heredado por rol, override manual y resultado final por permiso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PERMISSION_KEYS.map((permission) => {
            const inherited = rolePermissions.includes(permission);
            const granted = grantedPermissions.includes(permission);
            const revoked = revokedPermissions.includes(permission);
            const effective = effectivePermissionSet.has(permission);

            return (
              <div key={`effective-${permission}`} className="rounded-2xl border border-border bg-background px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{PERMISSION_LABELS[permission]}</p>
                    <p className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[permission]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={inherited ? 'outline' : 'secondary'}>{inherited ? 'Heredado por rol' : 'No heredado'}</Badge>
                    {granted ? <Badge variant="success">Override: Grant</Badge> : null}
                    {revoked ? <Badge variant="warning">Override: Revoke</Badge> : null}
                    <Badge variant={effective ? 'success' : 'warning'}>{effective ? 'Efectivo: Permitido' : 'Efectivo: Restringido'}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </form>
  );
}

function PermissionColumn({
  title,
  description,
  selectedPermissions,
  disabled,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  selectedPermissions: PermissionKey[];
  disabled: boolean;
  onAdd: (permission: PermissionKey) => void;
  onRemove: (permission: PermissionKey) => void;
}) {
  const availablePermissions = USER_MANAGEMENT_OVERRIDE_OPTIONS.filter((permission) => !selectedPermissions.includes(permission));

  return (
    <div className="rounded-3xl border border-border bg-background/70 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        <select
          disabled={disabled}
          defaultValue=""
          onChange={(event) => {
            const permission = event.target.value as PermissionKey;
            if (permission) {
              onAdd(permission);
              event.currentTarget.value = '';
            }
          }}
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">Agregar override...</option>
          {availablePermissions.map((permission) => (
            <option key={`available-${permission}`} value={permission}>
              {PERMISSION_LABELS[permission]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 space-y-3">
        {selectedPermissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Sin overrides en esta columna.
          </div>
        ) : (
          selectedPermissions.map((permission) => (
            <div key={`selected-${permission}`} className="rounded-2xl border border-border bg-background px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="block font-medium text-foreground">{PERMISSION_LABELS[permission]}</span>
                  <span className="mt-1 block text-muted-foreground">{PERMISSION_DESCRIPTIONS[permission]}</span>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onRemove(permission)} disabled={disabled}>
                  Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProtectionRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
