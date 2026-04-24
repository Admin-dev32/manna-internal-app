import type { Route } from 'next';
import Link from 'next/link';
import { AlarmClockCheck, BellRing, CalendarRange, ClipboardList, TriangleAlert, UsersRound } from 'lucide-react';

import { ReminderAreaBadge, ReminderSeverityBadge, ReminderTimingBadge } from '@/components/reminders/reminder-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { safeFormatDateTime } from '@/lib/utils/date';
import type { ReminderCenterData } from '@/types/reminders';

function formatDateTime(value: string | null) {
  return safeFormatDateTime(value, {
    fallback: 'Sin fecha',
    timeStyle: value?.includes('T') ? 'short' : undefined,
  });
}

export function RemindersDashboardPanel({ data }: { data: ReminderCenterData }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden bg-slate-950 text-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 text-white">Dashboard</Badge>
              <Badge className="bg-amber-500/20 text-amber-100">Recordatorios activos</Badge>
            </div>
            <CardTitle className="text-2xl">Centro de control de pendientes</CardTitle>
            <CardDescription className="text-slate-300">
              Capa suave de recordatorios calculados al consultar datos para no perder seguimiento comercial ni operativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={TriangleAlert} label="Vencidos" value={data.summary.overdue.toString()} hint="Atención inmediata." />
            <MetricCard icon={AlarmClockCheck} label="Para hoy" value={data.summary.today.toString()} hint="Revisar durante el día." />
            <MetricCard icon={CalendarRange} label="Próximos" value={data.summary.upcoming.toString()} hint="Preparación cercana." />
            <MetricCard icon={BellRing} label="Incompletos" value={data.summary.incomplete.toString()} hint="Huecos detectables." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prioridad inmediata</CardTitle>
            <CardDescription>Primero se muestran vencidos, luego hoy, después incompletos críticos y finalmente próximos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.topItems.length > 0 ? (
              data.topItems.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ReminderTimingBadge timing={item.timing} />
                        <ReminderAreaBadge area={item.area} />
                        <ReminderSeverityBadge severity={item.severity} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Button asChild variant="outline">
                      <Link href={item.href as Route}>Abrir</Link>
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{item.entityLabel}</Badge>
                    <Badge variant="outline">{formatDateTime(item.dueAt)}</Badge>
                    {item.responsibleLabel ? <Badge variant="outline">Responsable: {item.responsibleLabel}</Badge> : null}
                    {item.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                No hay recordatorios activos en este momento.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por área</CardTitle>
            <CardDescription>Ayuda a ver si el foco actual está en comercial, tareas o preparación operativa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AreaRow icon={UsersRound} label="Leads" value={data.summary.byArea.lead} />
            <AreaRow icon={ClipboardList} label="Tareas" value={data.summary.byArea.task} />
            <AreaRow icon={CalendarRange} label="Reservas" value={data.summary.byArea.pre_event} />
            <AreaRow icon={BellRing} label="Eventos" value={data.summary.byArea.event} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acceso rápido</CardTitle>
            <CardDescription>Atajo al centro de recordatorios completo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full justify-between">
              <Link href="/notificaciones">
                Ver centro de recordatorios
                <BellRing className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof TriangleAlert;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white/80">
        <Icon className="size-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{hint}</p>
    </div>
  );
}

function AreaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={value > 0 ? 'warning' : 'success'}>{value}</Badge>
    </div>
  );
}
