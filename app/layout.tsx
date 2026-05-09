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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem('manna.theme.mode');
                  var isNight = stored === 'day' ? false : true;
                  document.documentElement.classList.toggle('dark', isNight);
                  document.body && document.body.classList.toggle('dark', isNight);
                } catch (error) {
                  // no-op
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
