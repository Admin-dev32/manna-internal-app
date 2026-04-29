'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const SECTION_LINKS = [
  { href: '/finanzas', label: 'Overview' },
  { href: '/finanzas/invoices', label: 'Invoices' },
  { href: '/finanzas/expenses', label: 'Expenses' },
  { href: '/finanzas/reports', label: 'Reports' },
  { href: '/finanzas/accounting', label: 'Accounting' },
  { href: '/finanzas/taxes', label: 'Taxes' },
  { href: '/finanzas/settings', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/finanzas') return pathname === '/finanzas';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FinanceSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto rounded-2xl border border-border bg-background p-2" aria-label="Finance sections">
      <div className="flex min-w-max snap-x flex-nowrap gap-2 md:flex-wrap">
        {SECTION_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'snap-start whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors',
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
