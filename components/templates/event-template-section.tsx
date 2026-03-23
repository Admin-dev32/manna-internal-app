import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { applyOperationalTemplateToEventAction } from '@/services/operational-templates/actions';
import type { LeadProfileOption } from '@/types/leads';
import type { EventOperationalTemplateApplicationRecord } from '@/types/operational-templates';

export function EventTemplateSection({
  eventId,
  preEventId,
  templates,
  applications,
  profiles,
  disabledReason,
}: {
  eventId: string;
  preEventId?: string;
  templates: Array<{
    template: {
      id: string;
      name: string;
      event_type: string | null;
      note: string | null;
    };
    checklistItems: Array<{ id: string }>;
    taskItems: Array<{ id: string }>;
    materialItems: Array<{ id: string }>;
  }>;
  applications: EventOperationalTemplateApplicationRecord[];
  profiles: Record<string, LeadProfileOption>;
  disabledReason?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas operativas</CardTitle>
        <CardDescription>Aplica una base por tipo de evento para no reconstruir checklist, tareas y materiales desde cero.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {disabledReason ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            {disabledReason}
          </div>
        ) : null}

        {templates.length > 0 ? (
          <div className="space-y-4">
            {templates.map(({ template, checklistItems, taskItems, materialItems }) => (
              <div key={template.id} className="rounded-3xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{template.name}</p>
                      {template.event_type ? <Badge variant="outline">{template.event_type}</Badge> : <Badge variant="outline">Genérica</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{template.note ?? 'Sin notas adicionales.'}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Checklist: {checklistItems.length}</Badge>
                      <Badge variant="outline">Tareas: {taskItems.length}</Badge>
                      <Badge variant="outline">Materiales: {materialItems.length}</Badge>
                    </div>
                  </div>
                  <form action={applyOperationalTemplateToEventAction.bind(null, eventId, template.id, preEventId)}>
                    <Button type="submit" disabled={Boolean(disabledReason)}>
                      Aplicar plantilla
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            No hay plantillas activas disponibles para este tipo de evento.
          </div>
        )}

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Trazabilidad reciente</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cada aplicación registra cuántos elementos creó y qué quedó pendiente por falta de staff.</p>
          <div className="mt-4 space-y-3">
            {applications.length > 0 ? (
              applications.map((application) => (
                <div key={application.id} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(application.applied_at))}</Badge>
                    <Badge variant="outline">Checklist +{application.created_checklist_count}</Badge>
                    <Badge variant="outline">Tareas +{application.created_task_count}</Badge>
                    <Badge variant="outline">Materiales +{application.created_material_count}</Badge>
                    {application.skipped_task_count > 0 ? <Badge variant="warning">Tareas omitidas: {application.skipped_task_count}</Badge> : null}
                  </div>
                  <p className="mt-2">Aplicado por <strong className="text-foreground">{profiles[application.applied_by]?.full_name ?? 'Usuario interno'}</strong>.</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                Este evento aún no tiene aplicaciones de plantilla registradas.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
