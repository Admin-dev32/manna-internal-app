'use client';

import { useActionState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createManagedUserAction } from '@/services/user-management/actions';
import { initialUserManagementActionState } from '@/services/user-management/form-state';

export function UserCreateForm() {
  const [state, formAction] = useActionState(createManagedUserAction, initialUserManagementActionState);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Alta controlada de usuario</CardTitle>
          <Badge variant="secondary">Admin only</Badge>
        </div>
        <CardDescription>
          Crea o invita usuarios internos sin registro público. El sistema alinea auth, profile, rol inicial y acceso base.
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
              <label className="text-sm font-medium" htmlFor="create-user-role">
                Rol inicial
              </label>
              <select
                id="create-user-role"
                name="role"
                defaultValue="empleado"
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="empleado">Empleado</option>
                <option value="manager">Gerencia</option>
                <option value="owner">Propietario</option>
              </select>
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
          </div>

          <div className="flex justify-end">
            <Button type="submit">Crear o invitar usuario</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
