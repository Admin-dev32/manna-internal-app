import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_CONFIG } from '@/config/app';

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      <div className="page-shell min-h-screen items-center justify-center py-10">
        <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Manna Snack Bars</p>
              <h1 className="text-4xl font-semibold sm:text-5xl">Acceso interno conectado a Supabase.</h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                Este bloque deja listo el inicio de sesión real, la recuperación de acceso, las sesiones persistentes y la base funcional de roles para el equipo interno.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Sesión SSR y protección real de rutas',
                'Roles base: owner, manager y empleado',
                'Recuperación de acceso con enlace seguro',
                'Shell unificada para móvil y escritorio',
              ].map((item) => (
                <Card key={item} className="bg-white/80">
                  <CardContent className="p-4 text-sm text-muted-foreground">{item}</CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login">Entrar a la app</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/recuperar-acceso">Recuperar acceso</Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-primary/10">
            <CardHeader>
              <CardTitle>{APP_CONFIG.shortName}</CardTitle>
              <CardDescription>{APP_CONFIG.description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
