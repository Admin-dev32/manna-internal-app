import { ModulePage } from '@/features/module-shell/module-page';
import { requirePermission } from '@/lib/auth/guards';

export default async function ComunicacionPage() {
  await requirePermission('communication.view');
  return <ModulePage moduleKey="comunicacion" />;
}
