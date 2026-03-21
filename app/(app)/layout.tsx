import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { requireActiveSession } from '@/lib/auth/guards';

export default async function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await requireActiveSession();

  return <AppShell session={session}>{children}</AppShell>;
}
