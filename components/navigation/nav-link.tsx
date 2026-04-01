'use client';

import type { Route } from 'next';
import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BriefcaseBusiness,
  CalendarRange,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { NavigationIconKey } from '@/config/navigation';
import { cn } from '@/lib/utils';

const iconMap = {
  dashboard: LayoutDashboard,
  leads: BriefcaseBusiness,
  clientes: Users,
  cotizaciones: FileText,
  eventos: CalendarRange,
  tareas: ClipboardList,
  chat: MessagesSquare,
  notificaciones: Bell,
  comunicacion: MessageSquareText,
  empleados: ShieldCheck,
  finanzas: WalletCards,
  inventario: Package,
  configuracion: Settings,
} satisfies Record<NavigationIconKey, ComponentType<{ className?: string }>>;

interface NavLinkProps {
  href: Route;
  label: string;
  description?: string;
  icon: NavigationIconKey;
  matchPrefixes?: string[];
  compact?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}

function isRouteActive(pathname: string, href: Route, matchPrefixes: string[] = []) {
  if (pathname === href) return true;
  if (href === '/dashboard') return false;

  const prefixes = matchPrefixes.length > 0 ? matchPrefixes : [href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function NavLink({ href, label, description, icon, matchPrefixes, compact = false, collapsed = false, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = isRouteActive(pathname, href, matchPrefixes);
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 overflow-visible rounded-2xl border border-transparent text-sm transition-all',
        isActive
          ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:border-border hover:bg-white/90 hover:text-foreground',
        compact ? 'flex-col gap-1 px-2 py-2 text-xs' : 'py-3',
        collapsed && !compact ? 'justify-center px-2.5' : 'px-3.5',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-white shadow-sm transition-colors',
          compact ? 'size-9' : collapsed ? 'size-11' : 'size-10',
          isActive ? 'border-primary/10 bg-primary/5' : 'group-hover:border-border/80',
        )}
      >
        <Icon className={cn('size-5', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      </span>

      {!collapsed || compact ? (
        <span className={cn('flex min-w-0 flex-1 flex-col', compact && 'items-center')}>
          <span className={cn('truncate font-medium', compact && 'max-w-[72px] text-center text-[11px] leading-tight')}>
            {label}
          </span>
          {!compact && description ? <span className="truncate text-xs text-muted-foreground">{description}</span> : null}
        </span>
      ) : null}

      {!compact && !collapsed && isActive ? <Badge variant="default">Actual</Badge> : null}
      {collapsed && !compact ? (
        <>
          <span className={cn('absolute left-1 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-primary transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
          <span className="pointer-events-none absolute left-[calc(100%+0.85rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-lg lg:block lg:opacity-0 lg:transition lg:duration-150 lg:group-hover:opacity-100">
            {label}
          </span>
        </>
      ) : null}
    </Link>
  );
}
