'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BellRing, CalendarRange, ClipboardList, MessageSquareMore, Sparkles, TriangleAlert, UsersRound } from 'lucide-react';

import { ReminderAreaBadge, ReminderSeverityBadge, ReminderTimingBadge } from '@/components/reminders/reminder-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { safeFormatDateTime } from '@/lib/utils/date';
import { markAllInternalMentionNotificationsReadAction, markInternalMentionNotificationReadAction } from '@/services/internal-communication/actions';
import type { ReminderArea, ReminderCenterData } from '@/types/reminders';

function formatDateTime(value: string | null) {
  return safeFormatDateTime(value, {
    fallback: 'Sin fecha específica',
    timeStyle: value?.includes('T') ? 'short' : undefined,
  });
}

const SECTION_ORDER: ReminderArea[] = ['lead', 'task', 'pre_event', 'event', 'communication'];

export function RemindersCenter({ data }: { data: ReminderCenterData }) {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'unread' | 'mentions' | 'reminders'>('all');
  const [areaFilter, setAreaFilter] = useState<ReminderArea | 'all'>('all');

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      if (scopeFilter === 'unread' && item.channel === 'mention' && item.isRead) return false;
      if (scopeFilter === 'unread' && item.channel !== 'mention') return false;
      if (scopeFilter === 'mentions' && item.channel !== 'mention') return false;
      if (scopeFilter === 'reminders' && item.channel !== 'reminder') return false;
      if (areaFilter !== 'all' && item.area !== areaFilter) return false;
      return true;
    });
  }, [areaFilter, data.items, scopeFilter]);

  const unreadMentionCount = data.items.filter((item) => item.channel === 'mention' && !item.isRead).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Recordatorios</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Automatizaciones suaves</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Centro de pendientes y alertas internas</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Vista unificada para priorizar seguimiento comercial, tareas operativas, reservas y eventos sin montar cron jobs ni automatizaciones complejas todavía.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryPill label="Total" value={data.summary.total} />
          <SummaryPill label="Vencidos" value={data.summary.overdue} />
          <SummaryPill label="Hoy" value={data.summary.today} />
          <SummaryPill label="Próximos" value={data.summary.upcoming} />
          <SummaryPill label="Incompletos" value={data.summary.incomplete} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prioridad operativa</CardTitle>
              <CardDescription>Ordenado por vencidos, hoy, incompletos críticos y luego próximos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 px-3 py-3">
                <select
                  value={scopeFilter}
                  onChange={(event) => setScopeFilter(event.target.value as 'all' | 'unread' | 'mentions' | 'reminders')}
                  className="flex h-9 rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="all">Todas</option>
                  <option value="unread">No leídas</option>
                  <option value="mentions">Menciones</option>
                  <option value="reminders">Recordatorios</option>
                </select>
                <select
                  value={areaFilter}
                  onChange={(event) => setAreaFilter(event.target.value as ReminderArea | 'all')}
                  className="flex h-9 rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="all">Todos los módulos</option>
                  {SECTION_ORDER.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <Badge variant="outline">Menciones no leídas: {unreadMentionCount}</Badge>
                {unreadMentionCount > 0 ? (
                  <form action={markAllInternalMentionNotificationsReadAction.bind(null, '/notificaciones')}>
                    <Button type="submit" size="sm" variant="outline">Marcar menciones como leídas</Button>
                  </form>
                ) : null}
              </div>

              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ReminderTimingBadge timing={item.timing} />
                          <ReminderAreaBadge area={item.area} />
                          <ReminderSeverityBadge severity={item.severity} />
                          <Badge variant={item.channel === 'mention' ? 'warning' : 'outline'}>
                            {item.channel === 'mention' ? 'Mención' : 'Recordatorio'}
                          </Badge>
                          {item.channel === 'mention' ? (
                            <Badge variant={item.isRead ? 'success' : 'warning'}>
                              {item.isRead ? 'Leída' : 'No leída'}
                            </Badge>
                          ) : null}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <Button asChild variant="outline">
                        <Link href={item.href as Route}>Ir al detalle</Link>
                      </Button>
                    </div>
                    {item.channel === 'mention' && item.mentionNotificationId && !item.isRead ? (
                      <form className="mt-3" action={markInternalMentionNotificationReadAction.bind(null, item.mentionNotificationId, '/notificaciones')}>
                        <Button type="submit" variant="outline" size="sm">Marcar como leída</Button>
                      </form>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{item.entityLabel}</Badge>
                      <Badge variant="outline">{formatDateTime(item.dueAt)}</Badge>
                      {item.responsibleLabel ? <Badge variant="outline">Responsable: {item.responsibleLabel}</Badge> : null}
                      {item.tags.slice(0, 4).map((tag) => (
                        <Badge key={`${item.id}-${tag}`} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  No hay pendientes detectables con la lógica actual.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Jerarquía visual usada</CardTitle>
              <CardDescription>La capa prioriza lo urgente sin bloquear crecimiento futuro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <HierarchyRow icon={TriangleAlert} label="Vencido" description="Lo que ya rebasó fecha o seguimiento esperado." />
              <HierarchyRow icon={BellRing} label="Hoy" description="Lo que debe revisarse durante la jornada actual." />
              <HierarchyRow icon={Sparkles} label="Incompleto" description="Faltantes detectables que afectan preparación real." />
              <HierarchyRow icon={CalendarRange} label="Próximo" description="Trabajo cercano que conviene encaminar con anticipación." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen por módulo</CardTitle>
              <CardDescription>Distribución actual de recordatorios detectados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SECTION_ORDER.map((area) => (
                <ModuleRow key={area} area={area} count={data.summary.byArea[area]} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function HierarchyRow({
  icon: Icon,
  label,
  description,
}: {
  icon: typeof TriangleAlert;
  label: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-background p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ModuleRow({ area, count }: { area: ReminderArea; count: number }) {
  const configByArea = {
    lead: { label: 'Leads', icon: UsersRound },
    task: { label: 'Tareas', icon: ClipboardList },
    pre_event: { label: 'Reservas', icon: CalendarRange },
    event: { label: 'Eventos', icon: BellRing },
    communication: { label: 'Comunicación', icon: MessageSquareMore },
  } as const;
  const areaConfig = configByArea[area];
  const Icon = areaConfig.icon;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium">{areaConfig.label}</span>
      </div>
      <Badge variant={count > 0 ? 'warning' : 'success'}>{count}</Badge>
    </div>
  );
}
