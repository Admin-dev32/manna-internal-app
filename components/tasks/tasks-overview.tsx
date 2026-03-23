import type { Route } from 'next';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ClipboardList, Clock3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EVENT_TASK_PRIORITY_LABELS, EVENT_TASK_STATUS_LABELS } from '@/config/events';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord, EventTaskRecord, EventTaskStatus } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getTaskStatusBadgeVariant(status: EventTaskStatus) {
  switch (status) {
    case 'completada':
      return 'success';
    case 'bloqueada':
      return 'warning';
    case 'en_progreso':
      return 'default';
    default:
      return 'secondary';
  }
}

export function TasksOverview({
  tasks,
  events,
  clients,
  profiles,
}: {
  tasks: EventTaskRecord[];
  events: Record<string, EventRecord>;
  clients: Record<string, ClientRecord>;
  profiles: Record<string, LeadProfileOption>;
}) {
  const pendingTasks = tasks.filter((task) => task.status !== 'completada');
  const blockedTasks = tasks.filter((task) => task.status === 'bloqueada');
  const completedTasks = tasks.filter((task) => task.status === 'completada').slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Operación</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Tareas por evento y responsable</Badge>
        </div>
        <div className="mt-4 space-y-2">
          <h1 className="text-3xl font-semibold">Tareas</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Vista práctica para revisar pendientes, bloqueos y avances recientes sin convertir todavía este bloque en un módulo gigante.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={ClipboardList} label="Total" value={tasks.length.toString()} />
        <SummaryCard icon={Clock3} label="Pendientes" value={pendingTasks.length.toString()} />
        <SummaryCard icon={AlertCircle} label="Bloqueadas" value={blockedTasks.length.toString()} />
        <SummaryCard icon={CheckCircle2} label="Completadas" value={tasks.filter((task) => task.status === 'completada').length.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendientes y en progreso</CardTitle>
          <CardDescription>Prioriza lo que sigue abierto o requiere atención operativa.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTasks.map((task) => {
                  const event = events[task.event_id];
                  const client = event ? clients[event.client_id] : null;
                  const profile = profiles[task.assigned_profile_id];

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <Link href={`/eventos/${task.event_id}` as Route} className="font-medium text-foreground hover:text-primary">
                            {task.title}
                          </Link>
                          {task.description ? <p className="text-xs text-muted-foreground">{task.description}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/eventos/${task.event_id}` as Route} className="text-sm text-primary hover:underline">
                          #{task.event_id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{client?.full_name ?? 'Cliente'}</TableCell>
                      <TableCell>{profile?.full_name ?? 'Responsable interno'}</TableCell>
                      <TableCell>
                        <Badge variant={getTaskStatusBadgeVariant(task.status)}>{EVENT_TASK_STATUS_LABELS[task.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.priority === 'urgente' || task.priority === 'alta' ? 'warning' : 'secondary'}>
                          {EVENT_TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(task.due_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No hay tareas pendientes en este momento.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas completadas</CardTitle>
          <CardDescription>Seguimiento rápido de cierre operativo reciente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {completedTasks.length > 0 ? (
            completedTasks.map((task) => {
              const event = events[task.event_id];
              const client = event ? clients[event.client_id] : null;
              const profile = profiles[task.assigned_profile_id];

              return (
                <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {client?.full_name ?? 'Cliente'} · {profile?.full_name ?? 'Responsable interno'} · #{task.event_id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">{EVENT_TASK_STATUS_LABELS[task.status]}</Badge>
                    <Badge variant="outline">Editada {formatDateTime(task.updated_at)}</Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/eventos/${task.event_id}` as Route}>Ver evento</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Todavía no hay tareas completadas para mostrar aquí.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
