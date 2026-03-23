import { AlertCircle, CheckCircle2, ClipboardList, Clock3, PlayCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_TASK_PRIORITY_LABELS, EVENT_TASK_STATUS_LABELS } from '@/config/events';
import { createEventTaskAction, updateEventTaskAction, updateEventTaskStatusAction } from '@/services/events/actions';
import type { EventStaffAssignmentRecord, EventTaskRecord, EventTaskStatus } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hours = `${date.getUTCHours()}`.padStart(2, '0');
  const minutes = `${date.getUTCMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function getQuickStatusOptions(currentStatus: EventTaskStatus) {
  return (['pendiente', 'en_progreso', 'completada', 'bloqueada'] as const).filter((status) => status !== currentStatus);
}

export function EventTasksSection({
  eventId,
  tasks,
  assignments,
  profiles,
}: {
  eventId: string;
  tasks: EventTaskRecord[];
  assignments: EventStaffAssignmentRecord[];
  profiles: Record<string, LeadProfileOption>;
}) {
  const completedTasks = tasks.filter((task) => task.status === 'completada').length;
  const blockedTasks = tasks.filter((task) => task.status === 'bloqueada').length;
  const pendingTasks = tasks.length - completedTasks;

  const assignmentsByProfileId = Object.fromEntries(assignments.map((assignment) => [assignment.profile_id, assignment]));
  const tasksByProfileId = assignments.reduce(
    (accumulator, assignment) => ({
      ...accumulator,
      [assignment.profile_id]: tasks.filter((task) => task.assigned_profile_id === assignment.profile_id),
    }),
    {} as Record<string, EventTaskRecord[]>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas operativas</CardTitle>
        <CardDescription>Baja el evento a trabajo real por responsable, prioridad y estado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <SummaryStat icon={ClipboardList} label="Total" value={tasks.length.toString()} />
          <SummaryStat icon={Clock3} label="Pendientes" value={pendingTasks.toString()} />
          <SummaryStat icon={CheckCircle2} label="Completadas" value={completedTasks.toString()} />
          <SummaryStat icon={AlertCircle} label="Bloqueadas" value={blockedTasks.toString()} />
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Aún no hay tareas operativas para este evento.
          </div>
        ) : (
          <div className="space-y-5">
            {assignments.map((assignment) => {
              const assignedTasks = tasksByProfileId[assignment.profile_id] ?? [];
              const assignedProfile = profiles[assignment.profile_id];

              if (assignedTasks.length === 0) {
                return null;
              }

              return (
                <div key={assignment.profile_id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{assignedProfile?.full_name ?? 'Responsable interno'}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignedTasks.length} tarea{assignedTasks.length === 1 ? '' : 's'} ligada{assignedTasks.length === 1 ? '' : 's'} a este responsable.
                      </p>
                    </div>
                    <Badge variant="outline">{assignmentsByProfileId[assignment.profile_id]?.assignment_role ?? 'general'}</Badge>
                  </div>

                  <div className="space-y-4">
                    {assignedTasks.map((task) => {
                      const createdByProfile = profiles[task.created_by];
                      const updatedByProfile = profiles[task.updated_by];

                      return (
                        <div key={task.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={getTaskStatusBadgeVariant(task.status)}>{EVENT_TASK_STATUS_LABELS[task.status]}</Badge>
                                <Badge variant={task.priority === 'urgente' || task.priority === 'alta' ? 'warning' : 'secondary'}>
                                  Prioridad {EVENT_TASK_PRIORITY_LABELS[task.priority]}
                                </Badge>
                                {task.due_at ? <Badge variant="outline">Vence: {formatDateTime(task.due_at)}</Badge> : null}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{task.title}</p>
                                {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {getQuickStatusOptions(task.status).map((status) => (
                                <form key={status} action={updateEventTaskStatusAction.bind(null, eventId, task.id, status)}>
                                  <Button type="submit" variant="outline" size="sm">
                                    {status === 'en_progreso' ? <PlayCircle className="size-4" /> : null}
                                    {EVENT_TASK_STATUS_LABELS[status]}
                                  </Button>
                                </form>
                              ))}
                            </div>
                          </div>

                          <form action={updateEventTaskAction.bind(null, eventId, task.id)} className="mt-4 grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Título</label>
                              <Input name="title" defaultValue={task.title} />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Responsable</label>
                              <select
                                name="assigned_profile_id"
                                defaultValue={task.assigned_profile_id}
                                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {assignments.map((option) => {
                                  const profile = profiles[option.profile_id];
                                  return (
                                    <option key={option.profile_id} value={option.profile_id}>
                                      {profile?.full_name ?? option.profile_id}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descripción</label>
                              <Textarea name="description" rows={3} defaultValue={task.description ?? ''} placeholder="Qué se necesita hacer en esta tarea" />
                            </div>

                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Prioridad</label>
                                  <select
                                    name="priority"
                                    defaultValue={task.priority}
                                    className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  >
                                    {Object.entries(EVENT_TASK_PRIORITY_LABELS).map(([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                                  <select
                                    name="status"
                                    defaultValue={task.status}
                                    className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  >
                                    {Object.entries(EVENT_TASK_STATUS_LABELS).map(([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vence</label>
                                  <Input type="datetime-local" name="due_at" defaultValue={toDateTimeLocalValue(task.due_at)} />
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota interna</label>
                                  <Input name="internal_note" defaultValue={task.internal_note ?? ''} placeholder="Bloqueos, contexto, seguimiento..." />
                                </div>

                                <div className="flex items-end">
                                  <Button type="submit" className="w-full">
                                    Guardar tarea
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </form>

                          <div className="mt-4 grid gap-2 rounded-2xl bg-background px-4 py-3 text-xs text-muted-foreground md:grid-cols-2">
                            <span>Creada por: <strong className="text-foreground">{createdByProfile?.full_name ?? 'Usuario interno'}</strong></span>
                            <span>Última edición: <strong className="text-foreground">{updatedByProfile?.full_name ?? 'Usuario interno'}</strong></span>
                            <span>Creada: <strong className="text-foreground">{formatDateTime(task.created_at)}</strong></span>
                            <span>Editada: <strong className="text-foreground">{formatDateTime(task.updated_at)}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Crear tarea operativa</h3>
          <p className="mt-1 text-sm text-muted-foreground">Las tareas nuevas se asignan únicamente a responsables ya ligados al evento.</p>
          {assignments.length > 0 ? (
            <form action={createEventTaskAction.bind(null, eventId)} className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Título</label>
                <Input name="title" placeholder="Ej. Confirmar hora exacta de llegada del equipo" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Responsable</label>
                <select
                  name="assigned_profile_id"
                  defaultValue={assignments[0]?.profile_id ?? ''}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {assignments.map((assignment) => {
                    const profile = profiles[assignment.profile_id];
                    return (
                      <option key={assignment.profile_id} value={assignment.profile_id}>
                        {profile?.full_name ?? assignment.profile_id}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descripción</label>
                <Textarea name="description" rows={3} placeholder="Detalle operativo opcional para el responsable" />
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Prioridad</label>
                    <select
                      name="priority"
                      defaultValue="media"
                      className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {Object.entries(EVENT_TASK_PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                    <select
                      name="status"
                      defaultValue="pendiente"
                      className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {Object.entries(EVENT_TASK_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vence</label>
                    <Input type="datetime-local" name="due_at" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota interna</label>
                    <Input name="internal_note" placeholder="Bloqueos o recordatorio interno" />
                  </div>

                  <div className="flex items-end">
                    <Button type="submit" className="w-full">
                      Crear tarea
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Primero asigna personal al evento para poder crear tareas con responsables reales.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({
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
