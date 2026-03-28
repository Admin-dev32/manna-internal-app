'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  applyOperationalTemplateCompositionToEventAction,
  applyOperationalTemplateToEventAction,
} from '@/services/operational-templates/actions';
import type { LeadProfileOption } from '@/types/leads';
import type {
  EventOperationalTemplateApplicationRecord,
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';

type ApplicableTemplate = {
  template: {
    id: string;
    name: string;
    slug: string;
    service_category: string | null;
    event_type: string | null;
    note: string | null;
  };
  checklistItems: OperationalTemplateChecklistItemRecord[];
  taskItems: OperationalTemplateTaskItemRecord[];
  materialItems: OperationalTemplateMaterialItemRecord[];
};

type PreviewItem = {
  key: string;
  label: string;
  source: 'A' | 'B' | 'A+B';
  deduplicated: boolean;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('es-MX');
}

function buildPreviewList(
  sourceA: string[],
  sourceB: string[],
): PreviewItem[] {
  const map = new Map<string, PreviewItem>();

  for (const item of sourceA) {
    const key = normalize(item);
    if (!key) continue;
    map.set(key, { key, label: item, source: 'A', deduplicated: false });
  }

  for (const item of sourceB) {
    const key = normalize(item);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        source: 'A+B',
        deduplicated: true,
      });
    } else {
      map.set(key, { key, label: item, source: 'B', deduplicated: false });
    }
  }

  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

function PreviewBlock({
  title,
  items,
}: {
  title: string;
  items: PreviewItem[];
}) {
  const deduplicatedCount = items.filter((item) => item.deduplicated).length;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Final: {items.length}</Badge>
          <Badge variant="warning">Deduplicados: {deduplicatedCount}</Badge>
        </div>
      </div>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span className="text-foreground">{item.label}</span>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">Origen: {item.source}</Badge>
                {item.deduplicated ? <Badge variant="warning">Consolidado</Badge> : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Sin elementos para mostrar.</p>
        )}
      </div>
    </div>
  );
}

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
  templates: ApplicableTemplate[];
  applications: EventOperationalTemplateApplicationRecord[];
  profiles: Record<string, LeadProfileOption>;
  disabledReason?: string;
}) {
  const [templateAId, setTemplateAId] = useState<string>('');
  const [templateBId, setTemplateBId] = useState<string>('');

  const templateA = templates.find((entry) => entry.template.id === templateAId) ?? null;
  const templateB = templates.find((entry) => entry.template.id === templateBId) ?? null;

  const preview = useMemo(() => {
    if (!templateA || !templateB) {
      return {
        checklist: [] as PreviewItem[],
        tasks: [] as PreviewItem[],
        materials: [] as PreviewItem[],
      };
    }

    return {
      checklist: buildPreviewList(
        templateA.checklistItems.map((item) => item.label),
        templateB.checklistItems.map((item) => item.label),
      ),
      tasks: buildPreviewList(
        templateA.taskItems.map((item) => item.title),
        templateB.taskItems.map((item) => item.title),
      ),
      materials: buildPreviewList(
        templateA.materialItems.map((item) => item.name),
        templateB.materialItems.map((item) => item.name),
      ),
    };
  }, [templateA, templateB]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas operativas</CardTitle>
        <CardDescription>Aplica una base por tipo de evento o compón dos barras reales con preview antes de confirmar.</CardDescription>
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
                      {template.service_category ? <Badge variant="outline">{template.service_category}</Badge> : <Badge variant="outline">Genérica</Badge>}
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

        <div className="rounded-3xl border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold text-foreground">Compositor de plantillas (A + B)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona dos plantillas reales, revisa el resultado consolidado y luego confirma una aplicación compuesta.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Plantilla A</span>
              <select
                value={templateAId}
                onChange={(event) => setTemplateAId(event.target.value)}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecciona plantilla A</option>
                {templates.map(({ template }) => (
                  <option key={`a-${template.id}`} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Plantilla B</span>
              <select
                value={templateBId}
                onChange={(event) => setTemplateBId(event.target.value)}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecciona plantilla B</option>
                {templates.map(({ template }) => (
                  <option key={`b-${template.id}`} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
          </div>

          {templateA && templateB ? (
            <div className="mt-4 space-y-4">
              {templateA.template.id === templateB.template.id ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  Elige dos plantillas diferentes para generar la composición.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <p>
                      Composición seleccionada: <strong className="text-foreground">{templateA.template.name}</strong> +{' '}
                      <strong className="text-foreground">{templateB.template.name}</strong>.
                    </p>
                    <p className="mt-1">
                      Regla de deduplicación en preview: se normaliza por texto (`trim + minúsculas`) y si aparece en ambas, se consolida como <strong className="text-foreground">A+B</strong>.
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <PreviewBlock title="Checklist consolidada" items={preview.checklist} />
                    <PreviewBlock title="Tareas consolidadas" items={preview.tasks} />
                    <PreviewBlock title="Materiales consolidados" items={preview.materials} />
                  </div>

                  <form action={applyOperationalTemplateCompositionToEventAction.bind(null, eventId, templateA.template.id, templateB.template.id, preEventId)}>
                    <Button type="submit" disabled={Boolean(disabledReason)}>
                      Confirmar y aplicar composición
                    </Button>
                  </form>
                </>
              )}
            </div>
          ) : null}
        </div>

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
