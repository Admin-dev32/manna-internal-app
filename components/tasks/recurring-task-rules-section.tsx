import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_TASK_PRIORITY_LABELS, EVENT_TASK_STATUS_LABELS } from '@/config/events';
import { createRecurringTaskRuleAction, runDueRecurringTasksForEventAction, toggleRecurringTaskRuleActiveAction } from '@/services/tasks/recurring-actions';
import type { RecurringTaskRuleRecord } from '@/types/recurring-tasks';
import type { LeadProfileOption } from '@/types/leads';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getCadenceLabel(rule: RecurringTaskRuleRecord) {
  if (rule.cadence_type === 'daily') {
    return `Cada ${rule.interval_count} día${rule.interval_count === 1 ? '' : 's'}`;
  }

  if (rule.cadence_type === 'weekly') {
    const weekdayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `Cada ${rule.interval_count} semana${rule.interval_count === 1 ? '' : 's'} (${weekdayLabels[rule.day_of_week ?? 0]})`;
  }

  return `Cada ${rule.interval_count} mes${rule.interval_count === 1 ? '' : 'es'} (día ${rule.day_of_month ?? 1})`;
}

export function RecurringTaskRulesSection({
  eventId,
  rules,
  profiles,
  canManageTasks,
}: {
  eventId: string;
  rules: RecurringTaskRuleRecord[];
  profiles: Record<string, LeadProfileOption>;
  canManageTasks: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas recurrentes v1</CardTitle>
        <CardDescription>Genera tareas operativas reales automáticamente con recurrencia simple (diaria, semanal y mensual).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Reglas: {rules.length}</Badge>
          <Badge variant="outline">Activas: {rules.filter((rule) => rule.is_active).length}</Badge>
          {canManageTasks ? (
            <form action={runDueRecurringTasksForEventAction.bind(null, eventId)}>
              <Button type="submit" size="sm" variant="outline">Ejecutar reglas vencidas ahora</Button>
            </form>
          ) : null}
        </div>

        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Este evento aún no tiene reglas recurrentes configuradas.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{rule.title}</p>
                    {rule.description ? <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p> : null}
                  </div>
                  <Badge variant={rule.is_active ? 'success' : 'secondary'}>{rule.is_active ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{getCadenceLabel(rule)}</Badge>
                  <Badge variant="outline">Prioridad {EVENT_TASK_PRIORITY_LABELS[rule.priority]}</Badge>
                  <Badge variant="outline">Estado base {EVENT_TASK_STATUS_LABELS[rule.status_template]}</Badge>
                  <Badge variant="outline">Próxima ejecución: {formatDateTime(rule.next_run_at)}</Badge>
                  {rule.assigned_profile_id ? <Badge variant="outline">Responsable: {profiles[rule.assigned_profile_id]?.full_name ?? 'Perfil interno'}</Badge> : null}
                </div>
                {canManageTasks ? (
                  <form className="mt-3" action={toggleRecurringTaskRuleActiveAction.bind(null, eventId, rule.id, !rule.is_active)}>
                    <Button type="submit" variant="outline" size="sm">
                      {rule.is_active ? 'Pausar regla' : 'Reactivar regla'}
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {canManageTasks ? (
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">Crear regla recurrente</h3>
            <form className="mt-4 grid gap-4 xl:grid-cols-2" action={createRecurringTaskRuleAction.bind(null, eventId)}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Título</label>
                <Input name="title" placeholder="Ej. Revisión semanal de inventario del evento" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Responsable (opcional)</label>
                <select
                  name="assigned_profile_id"
                  defaultValue=""
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Sin responsable fijo (usa creador)</option>
                  {Object.values(profiles)
                    .filter((profile) => profile.is_active)
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name ?? profile.id}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descripción</label>
                <Textarea name="description" rows={3} placeholder="Detalle breve de la tarea a generar" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota interna</label>
                <Input name="internal_note" placeholder="Contexto interno de seguimiento" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Frecuencia</label>
                <select name="cadence_type" defaultValue="weekly" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Intervalo</label>
                <Input name="interval_count" type="number" min={1} max={30} defaultValue={1} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Día de semana (0=Dom, 6=Sáb)</label>
                <Input name="day_of_week" type="number" min={0} max={6} placeholder="Solo para semanal" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Día de mes (1-31)</label>
                <Input name="day_of_month" type="number" min={1} max={31} placeholder="Solo para mensual" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Fecha de inicio</label>
                <Input name="start_date" type="date" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hora objetivo</label>
                <Input name="due_time" type="time" defaultValue="09:00" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Prioridad</label>
                <select name="priority" defaultValue="media" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  {Object.entries(EVENT_TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado inicial</label>
                <select name="status_template" defaultValue="pendiente" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  {Object.entries(EVENT_TASK_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end xl:col-span-2">
                <Button type="submit">Guardar regla recurrente</Button>
              </div>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
