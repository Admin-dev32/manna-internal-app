'use server';

import { revalidatePath } from 'next/cache';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PERMISSION_KEYS, USER_ROLES } from '@/types/auth';
import type { UserManagementActionState } from '@/types/user-management';

function getCheckedValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}

export async function updateManagedUserAction(
  userId: string,
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: 'error',
      message: 'No se pudo conectar con Supabase para guardar los cambios.',
    };
  }

  const role = String(formData.get('role') ?? 'empleado');
  const isActive = formData.get('is_active') === 'on';
  const adminNotes = String(formData.get('admin_notes') ?? '');
  const grantedPermissions = getCheckedValues(formData, 'granted_permissions');
  const revokedPermissions = getCheckedValues(formData, 'revoked_permissions');

  if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    return {
      status: 'error',
      message: 'Selecciona un rol válido.',
    };
  }

  const invalidPermission = [...grantedPermissions, ...revokedPermissions].find((permission) => !PERMISSION_KEYS.includes(permission as (typeof PERMISSION_KEYS)[number]));
  if (invalidPermission) {
    return {
      status: 'error',
      message: `Se detectó un permiso inválido: ${invalidPermission}.`,
    };
  }

  if (grantedPermissions.some((permission) => revokedPermissions.includes(permission))) {
    return {
      status: 'error',
      message: 'Un permiso no puede estar otorgado y revocado al mismo tiempo.',
    };
  }

  const { error } = await supabase.rpc('admin_update_user', {
    target_user_id: userId,
    target_role: role,
    target_is_active: isActive,
    target_admin_notes: adminNotes,
    granted_permissions: grantedPermissions,
    revoked_permissions: revokedPermissions,
  });

  if (error) {
    return {
      status: 'error',
      message: error.message || 'No fue posible actualizar el usuario.',
    };
  }

  revalidatePath('/configuracion');
  revalidatePath('/configuracion/usuarios');
  revalidatePath(`/configuracion/usuarios/${userId}`);
  revalidatePath('/', 'layout');

  return {
    status: 'success',
    message: 'Usuario actualizado correctamente.',
  };
}
