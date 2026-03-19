import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/config/app';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.shortName} | Base interna`,
    template: `%s | ${APP_CONFIG.shortName}`,
  },
  description: APP_CONFIG.description,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
