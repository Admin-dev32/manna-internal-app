'use client';

import { useActionState, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BASE_ROLE_LABELS, getOperationalProfilePresetPermissions, OPERATIONAL_PROFILE_LABELS } from '@/config/user-access-presets';
import { createManagedUserAction } from '@/services/user-management/actions';
import { initialUserManagementActionState } from '@/services/user-management/form-state';
import { PERMISSION_LABELS } from '@/config/permissions';
import type { OperationalProfile, SystemBaseRole } from '@/types/auth';

export function UserCreateForm() {
  const [state, formAction] = useActionState(createManagedUserAction, initialUserManagementActionState);
  const [baseRole, setBaseRole] = useState<SystemBaseRole>('employee');
  const [operationalProfile, setOperationalProfile] = useState<OperationalProfile>('general_staff');
  const presetPermissions = useMemo(
    () => getOperationalProfilePresetPermissions(baseRole, operationalProfile),
    [baseRole, operationalProfile],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Alta controlada de usuario</CardTitle>
          <Badge variant="secondary">Admin only</Badge>
        </div>
        <CardDescription>
          Crea o invita usuarios internos sin registro público. Define rol base + perfil operativo y usa presets como punto de partida.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.status !== 'idle' ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-user-email">
                Correo corporativo
              </label>
              <Input
                id="create-user-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={120}
                required
                placeholder="nombre@manna.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-user-full-name">
                Nombre completo (opcional)
              </label>
              <Input
                id="create-user-full-name"
                name="full_name"
                type="text"
                maxLength={120}
                placeholder="Ej. Andrea Rivas"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-user-base-role">
                Rol base del sistema
              </label>
              <select
                id="create-user-base-role"
                name="base_role"
                defaultValue={baseRole}
                onChange={(event) => setBaseRole(event.target.value as SystemBaseRole)}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(BASE_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-user-operational-profile">
                Perfil operativo global
              </label>
              <select
                id="create-user-operational-profile"
                name="operational_profile"
                defaultValue={operationalProfile}
                onChange={(event) => setOperationalProfile(event.target.value as OperationalProfile)}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(OPERATIONAL_PROFILE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Preset inicial sugerido</p>
            {presetPermissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin permisos extra por perfil operativo para esta combinación.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {presetPermissions.map((permission) => (
                  <Badge key={`preset-${permission}`} variant="secondary">
                    {PERMISSION_LABELS[permission]}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado inicial</p>
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input type="checkbox" name="is_active" defaultChecked className="size-4 rounded border-border" />
              Usuario activo al crear/invitar
            </label>
            <p className="text-xs text-muted-foreground">
              Si queda inactivo, no podrá entrar aunque reciba invitación hasta que un admin lo habilite.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Crear o invitar usuario</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
