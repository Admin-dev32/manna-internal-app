'use client';

import { MobileMenu } from '@/components/navigation/mobile-menu';
import type { AppUser } from '@/types/auth';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  user: AppUser | null;
  isDemoMode?: boolean;
  themeMode: 'day' | 'night';
  onThemeModeChange: (mode: 'day' | 'night') => void;
}

export function MobileNav({ open, onClose, user, isDemoMode = false, themeMode, onThemeModeChange }: MobileNavProps) {
  return (
    <MobileMenu
      open={open}
      onClose={onClose}
      user={user}
      isDemoMode={isDemoMode}
      themeMode={themeMode}
      onThemeModeChange={onThemeModeChange}
    />
  );
}

