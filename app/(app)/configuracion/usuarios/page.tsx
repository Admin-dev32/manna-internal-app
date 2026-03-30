import { requirePermission } from '@/lib/auth/guards';
import { getManagedUsers } from '@/services/user-management/queries';

import { UsersList } from '@/components/user-management/users-list';

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  await requirePermission('admin.users.manage');

  const resolvedSearchParams = await searchParams;
  const searchTerm = resolvedSearchParams?.q?.trim() ?? '';
  const users = await getManagedUsers(searchTerm);

  return <UsersList users={users} searchTerm={searchTerm} />;
}
