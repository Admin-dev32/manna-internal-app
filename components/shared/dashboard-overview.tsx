import { ArrowUpRight, CalendarClock, CircleDollarSign, UsersRound } from 'lucide-react';

import { AlertBanner } from '@/components/shared/alert-banner';
import { DataPreviewTable } from '@/components/shared/data-preview-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const metrics = [
  {
    label: 'Módulos preparados',
    value: '12',
    hint: 'Rutas base con placeholders consistentes.',
    icon: UsersRound,
  },
  {
    label: 'Roles base',
    value: '3',
    hint: 'Owner, manager y empleado listos para evolucionar.',
    icon: ArrowUpRight,
  },
  {
    label: 'Integración auth',
    value: 'Supabase',
    hint: 'Cliente SSR y middleware inicial preparados.',
    icon: CalendarClock,
  },
  {
    label: 'Escalabilidad',
    value: 'Alta',
    hint: 'Arquitectura pensada para módulos y automatizaciones.',
    icon: CircleDollarSign,
  },
];

export function DashboardOverview() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="mt-2 text-2xl">{metric.value}</CardTitle>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{metric.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden bg-slate-950 text-white">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/10 text-white">Dashboard</Badge>
                <Badge className="bg-emerald-500/20 text-emerald-100">Base operativa lista</Badge>
              </div>
              <CardTitle className="text-2xl">Centro de control de Manna Snack Bars</CardTitle>
              <CardDescription className="text-slate-300">
                Este dashboard presenta la base de navegación, diseño y estructura técnica sobre la que crecerán CRM, operación, finanzas e inventario.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>Explorar roadmap</Button>
              <Button variant="secondary">Revisar permisos base</Button>
            </CardContent>
          </Card>

          <AlertBanner
            title="Arquitectura preparada para producción futura"
            description="La app ya quedó organizada para App Router, Supabase SSR, roles base, servicios desacoplados y automatizaciones posteriores con GitHub Actions."
          />

          <Card>
            <CardHeader>
              <CardTitle>Áreas listas para crecer</CardTitle>
              <CardDescription>Vista previa de cómo se organizarán los siguientes bloques del producto.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataPreviewTable />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Próximos pasos sugeridos</CardTitle>
            <CardDescription>Secuencia recomendada para continuar sin comprometer mantenibilidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Definir esquema inicial de base de datos en Supabase.',
              'Implementar flujo real de acceso y recuperación de contraseña.',
              'Construir el primer dominio funcional: Leads o Clientes.',
              'Agregar auditoría y notificaciones con eventos reales.',
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-background p-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
