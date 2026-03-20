import { ArrowRight, Sparkles } from 'lucide-react';

import { AlertBanner } from '@/components/shared/alert-banner';
import { DataPreviewTable } from '@/components/shared/data-preview-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { moduleDefinitions } from './module-definitions';

interface ModulePageProps {
  moduleKey: keyof typeof moduleDefinitions;
}

export function ModulePage({ moduleKey }: ModulePageProps) {
  const definition = moduleDefinitions[moduleKey];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Bloque 1</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">{definition.status}</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{definition.title}</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">{definition.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {definition.primaryAction ? <Button>{definition.primaryAction}</Button> : null}
          {definition.secondaryAction ? <Button variant="secondary">{definition.secondaryAction}</Button> : null}
        </div>
      </section>

      <AlertBanner
        title="Módulo en preparación"
        description="Esta pantalla ya tiene la estructura visual, navegación y punto de entrada listos para crecer sin rehacer la base de la app."
        variant="info"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <EmptyState
            icon={definition.icon}
            title={`Aquí vivirá ${definition.title.toLowerCase()}`}
            description={definition.status}
            primaryAction={definition.primaryAction}
            secondaryAction={definition.secondaryAction}
          />

          <Card>
            <CardHeader>
              <CardTitle>Preparado para el siguiente bloque</CardTitle>
              <CardDescription>La arquitectura ya contempla expansión gradual por dominio, permisos y servicios.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {definition.bullets.map((bullet) => (
                <div key={bullet} className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <p className="text-sm font-medium">{bullet}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checklist de avance</CardTitle>
              <CardDescription>Vista de referencia para las siguientes iteraciones del producto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                <span>Estructura visual</span>
                <Badge variant="success">Lista</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                <span>Modelo de negocio</span>
                <Badge variant="warning">Pendiente</Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                <span>Permisos granulares</span>
                <Badge variant="warning">Pendiente</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vista previa de roadmap</CardTitle>
              <CardDescription>Resumen base para auditoría, notificaciones y automatizaciones futuras.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataPreviewTable />
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full justify-between">
            Revisar dependencias del módulo
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
