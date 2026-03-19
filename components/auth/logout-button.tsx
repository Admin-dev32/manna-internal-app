import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/services/auth/actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm">
        <LogOut className="size-4" />
        Cerrar sesión
      </Button>
    </form>
  );
}
