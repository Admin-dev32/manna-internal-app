import { ModulePage } from '@/features/module-shell/module-page';
import { requirePermission } from '@/lib/auth/guards';

export default async function EmpleadosPage() {
  await requirePermission('employees.view');
  return <ModulePage moduleKey="empleados" />;
}
