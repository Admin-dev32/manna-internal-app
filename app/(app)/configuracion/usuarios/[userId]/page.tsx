import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import { UserAccessForm } from '@/components/user-management/user-access-form';
import { Button } from '@/components/ui/button';
import { requirePermission } from '@/lib/auth/guards';
import { getManagedUserDetail } from '@/services/user-management/queries';

export default async function UsuarioDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePermission('admin.users.manage');

  const { userId } = await params;
  const user = await getManagedUserDetail(userId);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="outline">
        <Link href="/configuracion/usuarios">
          <ArrowLeft className="size-4" />
          Volver al listado
        </Link>
      </Button>
      <UserAccessForm user={user} />
    </div>
  );
}
