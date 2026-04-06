'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth/guards';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PERMISSION_KEYS, USER_ROLES } from '@/types/auth';
import type { UserManagementActionState } from '@/types/user-management';

const corporateEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function getCheckedValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}

async function findAuthUserByEmail(email: string) {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { user: null, error: 'No se pudo conectar con Supabase Admin para buscar usuarios.' } as const;
  }

  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return { user: null, error: error.message || 'No se pudo consultar usuarios en auth.' } as const;
  }

  const match = (data.users ?? []).find((user) => (user.email ?? '').toLowerCase() === email.toLowerCase()) ?? null;
  return { user: match, error: null } as const;
}

export async function createManagedUserAction(
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  await requirePermission('admin.users.manage');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const role = String(formData.get('role') ?? 'empleado');
  const isActive = formData.get('is_active') === 'on';

  if (!email) {
    return {
      status: 'error',
      message: 'Ingresa un correo para crear o invitar al usuario.',
    };
  }

  if (!corporateEmailPattern.test(email)) {
    return {
      status: 'error',
      message: 'Ingresa un correo válido (ej. nombre@manna.com).',
    };
  }

  if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    return {
      status: 'error',
      message: 'Selecciona un rol válido.',
    };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return {
      status: 'error',
      message: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY para crear usuarios.',
    };
  }

  const { user: existingAuthUser, error: findUserError } = await findAuthUserByEmail(email);
  if (findUserError) {
    return {
      status: 'error',
      message: findUserError,
    };
  }

  let targetUserId = existingAuthUser?.id ?? null;
  let invitationSent = false;

  if (!targetUserId) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email,
        role,
      },
      redirectTo: `${supabaseEnv.appUrl}/auth/callback?next=/actualizar-clave&flow=invite`,
    });

    if (error) {
      return {
        status: 'error',
        message: error.message || 'No se pudo enviar la invitación del usuario.',
      };
    }

    targetUserId = data.user?.id ?? null;
    invitationSent = true;
  }

  if (!targetUserId) {
    const retryLookup = await findAuthUserByEmail(email);
    if (retryLookup.user?.id) {
      targetUserId = retryLookup.user.id;
    }
  }

  if (!targetUserId) {
    return {
      status: 'error',
      message: 'No se pudo identificar el usuario en auth después de crear/invitar. Intenta de nuevo.',
    };
  }

  const { error: profileUpsertError } = await adminClient.from('profiles').upsert(
    {
      id: targetUserId,
      full_name: fullName || email,
      role,
      is_active: isActive,
    },
    { onConflict: 'id' },
  );

  if (profileUpsertError) {
    return {
      status: 'error',
      message: profileUpsertError.message || 'No se pudo preparar el perfil interno del usuario.',
    };
  }

  const { error: accessControlUpsertError } = await adminClient.from('user_access_controls').upsert(
    {
      user_id: targetUserId,
      is_site_owner: false,
      admin_notes: null,
    },
    { onConflict: 'user_id' },
  );

  if (accessControlUpsertError) {
    return {
      status: 'error',
      message: accessControlUpsertError.message || 'No se pudo preparar los controles de acceso del usuario.',
    };
  }

  await adminClient.from('user_permission_overrides').delete().eq('user_id', targetUserId);

  const sessionSupabase = await createSupabaseServerClient();
  if (!sessionSupabase) {
    return {
      status: 'error',
      message: 'No se pudo validar la sesión administrativa para finalizar el alta.',
    };
  }

  const { error: adminUpdateError } = await sessionSupabase.rpc('admin_update_user', {
    target_user_id: targetUserId,
    target_role: role,
    target_is_active: isActive,
    target_admin_notes: '',
    granted_permissions: [],
    revoked_permissions: [],
  });

  if (adminUpdateError) {
    return {
      status: 'error',
      message: adminUpdateError.message || 'No se pudo finalizar la configuración inicial del usuario.',
    };
  }

  revalidatePath('/configuracion');
  revalidatePath('/configuracion/usuarios');
  revalidatePath(`/configuracion/usuarios/${targetUserId}`);
  revalidatePath('/', 'layout');

  return {
    status: 'success',
    message: invitationSent
      ? 'Usuario creado e invitación enviada. El usuario debe revisar su correo para definir su clave de acceso.'
      : 'El usuario ya existía en auth. Se actualizó su perfil y acceso inicial correctamente.',
  };
}

export async function updateManagedUserAction(
  userId: string,
  _previousState: UserManagementActionState,
  formData: FormData,
): Promise<UserManagementActionState> {
  await requirePermission('admin.users.manage');

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
