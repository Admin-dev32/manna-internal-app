import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';
import { isSupabaseAuthEnabled } from '@/lib/supabase/env';

const guestOnlyRoutes = ['/login', '/recuperar-acceso'];
const publicRoutes = ['/actualizar-clave', '/auth/callback', ...guestOnlyRoutes];
const protectedRoutes = [
  '/dashboard',
  '/leads',
  '/clientes',
  '/cotizaciones',
  '/eventos',
  '/tareas',
  '/notificaciones',
  '/comunicacion',
  '/empleados',
  '/finanzas',
  '/inventario',
  '/configuracion',
];

function matchesPath(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user } = await updateSession(request);

  if (!isSupabaseAuthEnabled()) {
    return response;
  }

  if (matchesPath(pathname, protectedRoutes) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (matchesPath(pathname, guestOnlyRoutes) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (matchesPath(pathname, publicRoutes)) {
    return response;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
