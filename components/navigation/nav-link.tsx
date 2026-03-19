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
  compact?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavLink({ href, label, description, icon, compact = false, collapsed = false, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm transition-all',
        isActive
          ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:border-border hover:bg-white hover:text-foreground',
        compact && 'flex-col gap-1 rounded-3xl px-2 py-2 text-xs',
        collapsed && !compact && 'justify-center px-2 py-3',
      )}
    >
      <span className={cn('flex size-10 items-center justify-center rounded-2xl bg-white shadow-sm', compact && 'size-9')}>
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
    </Link>
  );
}
