import type { Route } from 'next';
import type { ComponentType } from 'react';
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

import {
  mainNavigationItems,
  NAVIGATION_SECTION_LABELS,
  type NavigationIconKey,
  type NavigationItem,
  type NavigationSectionKey,
} from '@/config/navigation';
import {
  platformNavigationModules,
  type PlatformModule,
  type PlatformSubmodule,
} from '@/config/platform-navigation';
import { hasPermission } from '@/lib/auth/permissions';
import type { AppUser, PermissionKey } from '@/types/auth';

export const PLATFORM_NAVIGATION_SECTION_ORDER: NavigationSectionKey[] = ['comercial', 'operacion', 'coordinacion', 'administracion'];

export const platformNavigationIconMap = {
  dashboard: LayoutDashboard,
  leads: BriefcaseBusiness,
  clientes: Users,
  cotizaciones: FileText,
  eventos: CalendarRange,
  tareas: ClipboardList,
  chat: MessagesSquare,
  notificaciones: Bell,
  comunicacion: MessageSquareText,
  tickets: BriefcaseBusiness,
  empleados: ShieldCheck,
  finanzas: WalletCards,
  inventario: Package,
  configuracion: Settings,
} satisfies Record<NavigationIconKey, ComponentType<{ className?: string }>>;

export interface GroupedNavigationItems {
  section: NavigationSectionKey;
  label: string;
  items: NavigationItem[];
}

export function getVisibleNavigationItems(user: AppUser | null): NavigationItem[] {
  if (!user) return [];
  return mainNavigationItems.filter((item) => hasPermission(user, item.permission));
}

export function getGroupedNavigationItems(user: AppUser | null): GroupedNavigationItems[] {
  const visibleItems = getVisibleNavigationItems(user);

  return PLATFORM_NAVIGATION_SECTION_ORDER.map((section) => ({
    section,
    label: NAVIGATION_SECTION_LABELS[section],
    items: visibleItems.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
}

export function getPrimaryNavigationItems(user: AppUser | null): NavigationItem[] {
  const visibleItems = getVisibleNavigationItems(user);
  const preferredHrefs = ['/dashboard', '/leads', '/reservas', '/eventos', '/finanzas'] as Route[];

  return preferredHrefs
    .map((href) => visibleItems.find((item) => item.href === href))
    .filter(Boolean)
    .slice(0, 5) as NavigationItem[];
}

export function isNavigationItemActive(pathname: string, href: Route, matchPrefixes: string[] = []) {
  if (pathname === href) return true;
  if (href === '/dashboard') return false;

  const prefixes = matchPrefixes.length > 0 ? matchPrefixes : [href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}


function hasAnyPermission(user: AppUser | null, permissions: readonly PermissionKey[]) {
  if (!user) return false;
  return permissions.some((permission) => hasPermission(user, permission));
}

export function getVisiblePlatformSubmodules(module: PlatformModule, user: AppUser | null): PlatformSubmodule[] {
  return module.submodules.filter((submodule) => hasAnyPermission(user, submodule.permissions));
}

export function getVisiblePlatformModules(user: AppUser | null): PlatformModule[] {
  return platformNavigationModules.filter((module) => {
    if (hasAnyPermission(user, module.permissions)) return true;
    return getVisiblePlatformSubmodules(module, user).length > 0;
  });
}

export function isPlatformSubmoduleActive(pathname: string, submodule: PlatformSubmodule) {
  if (!submodule.href) return false;
  if (pathname === submodule.href) return true;

  const prefixes = submodule.matchPrefixes ?? [];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPlatformModuleActive(pathname: string, module: PlatformModule) {
  if (pathname === module.defaultHref) return true;

  if (module.submodules.some((submodule) => isPlatformSubmoduleActive(pathname, submodule))) {
    return true;
  }

  return module.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getActivePlatformModule(pathname: string, user: AppUser | null): PlatformModule | null {
  return getVisiblePlatformModules(user).find((module) => isPlatformModuleActive(pathname, module)) ?? null;
}

function getPlatformSubmoduleMatchScore(pathname: string, submodule: PlatformSubmodule) {
  if (!submodule.href) return -1;
  if (pathname === submodule.href) return submodule.href.length + 1000;

  const prefixes = submodule.matchPrefixes ?? [];
  const matchingPrefix = prefixes
    .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];

  return matchingPrefix ? matchingPrefix.length : -1;
}

export function getActivePlatformSubmodule(pathname: string, module: PlatformModule, user: AppUser | null): PlatformSubmodule | null {
  return getVisiblePlatformSubmodules(module, user)
    .map((submodule) => ({
      submodule,
      score: getPlatformSubmoduleMatchScore(pathname, submodule),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.submodule ?? null;
}
