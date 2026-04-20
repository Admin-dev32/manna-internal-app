import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EVENT_ASSIGNMENT_ROLE_LABELS, EVENT_TASK_PRIORITY_LABELS, EVENT_TASK_STATUS_LABELS } from '@/config/events';
import {
  bootstrapOperationalTemplatesAction,
  createOperationalTemplateAction,
  createOperationalTemplateChecklistItemAction,
  createOperationalTemplateMaterialItemAction,
  createOperationalTemplateTaskItemAction,
  removeOperationalTemplateChecklistItemAction,
  removeOperationalTemplateMaterialItemAction,
  removeOperationalTemplateTaskItemAction,
  updateOperationalTemplateAction,
  updateOperationalTemplateChecklistItemAction,
  updateOperationalTemplateMaterialItemAction,
  updateOperationalTemplateTaskItemAction,
} from '@/services/operational-templates/actions';
import type { LeadProfileOption } from '@/types/leads';
import type {
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';

export function OperationalTemplatesManager({
  templates,
  checklistItems,
  taskItems,
  materialItems,
  profiles,
}: {
  templates: OperationalTemplateRecord[];
  checklistItems: OperationalTemplateChecklistItemRecord[];
  taskItems: OperationalTemplateTaskItemRecord[];
  materialItems: OperationalTemplateMaterialItemRecord[];
  profiles: Record<string, LeadProfileOption>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Plantillas operativas</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Configura recetas operativas por tipo de evento para prellenar checklist, tareas y materiales base sin rehacer cada preparación.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Crear plantilla</CardTitle>
          <CardDescription>Base mínima para luego sumar checklist, tareas y materiales relacionados.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={bootstrapOperationalTemplatesAction} className="mb-4">
            <Button type="submit" variant="outline">Cargar pack semilla opcional (no recomendado como base principal)</Button>
          </form>
          <form action={createOperationalTemplateAction} className="grid gap-4 xl:grid-cols-[1.1fr_1fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nombre</label>
              <Input name="name" placeholder="Ej. Cumpleaños infantil base" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tipo de evento / categoría</label>
              <Input name="service_category" placeholder="Ej. mini-pancake-bar" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
              <select
                name="is_active"
                defaultValue="true"
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descripción operativa corta</label>
              <Textarea name="description" rows={2} placeholder="Descripción breve del servicio/bar." />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Notas</label>
              <Textarea name="note" rows={3} placeholder="Notas opcionales sobre cuándo usar la plantilla o cómo adaptarla." />
            </div>
            <input name="event_type" type="hidden" value="" />
            <div className="flex items-end">
              <Button type="submit" className="w-full">Crear plantilla</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {templates.map((template) => {
        const templateChecklistItems = checklistItems.filter((item) => item.template_id === template.id);
        const templateTaskItems = taskItems.filter((item) => item.template_id === template.id);
        const templateMaterialItems = materialItems.filter((item) => item.template_id === template.id);
        const createdBy = profiles[template.created_by];
        const updatedBy = profiles[template.updated_by];

        return (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>
                {template.service_category ? `Servicio/categoría: ${template.service_category}.` : 'Plantilla genérica.'} Checklist: {templateChecklistItems.length} · Tareas: {templateTaskItems.length} · Materiales: {templateMaterialItems.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={updateOperationalTemplateAction.bind(null, template.id)} className="grid gap-4 xl:grid-cols-[1.1fr_1fr_auto]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nombre</label>
                  <Input name="name" defaultValue={template.name} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tipo de evento / categoría</label>
                  <Input name="service_category" defaultValue={template.service_category ?? template.event_type ?? ''} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                  <select
                    name="is_active"
                    defaultValue={template.is_active ? 'true' : 'false'}
                    className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Descripción operativa corta</label>
                  <Textarea name="description" rows={2} defaultValue={template.description ?? ''} />
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Notas</label>
                  <Textarea name="note" rows={3} defaultValue={template.note ?? ''} />
                </div>
                <input name="event_type" type="hidden" value={template.service_category ?? template.event_type ?? ''} />
                <div className="flex items-end">
                  <Button type="submit" className="w-full">Guardar base</Button>
                </div>
              </form>

              <div className="grid gap-6 xl:grid-cols-3">
                <TemplateChecklistColumn templateId={template.id} items={templateChecklistItems} />
                <TemplateTasksColumn templateId={template.id} items={templateTaskItems} />
                <TemplateMaterialsColumn templateId={template.id} items={templateMaterialItems} />
              </div>

              <div className="grid gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground md:grid-cols-2">
                <span>Creada por: <strong className="text-foreground">{createdBy?.full_name ?? 'Usuario interno'}</strong></span>
                <span>Última edición: <strong className="text-foreground">{updatedBy?.full_name ?? 'Usuario interno'}</strong></span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TemplateChecklistColumn({
  templateId,
  items,
}: {
  templateId: string;
  items: OperationalTemplateChecklistItemRecord[];
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold text-foreground">Checklist base</h3>
        <p className="text-sm text-muted-foreground">Ítems operativos que deben existir al aplicar la plantilla.</p>
      </div>

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-background p-3">
          <form action={updateOperationalTemplateChecklistItemAction.bind(null, templateId, item.id)} className="space-y-3">
            <Input name="label" defaultValue={item.label} />
            <Input name="description" defaultValue={item.description ?? ''} placeholder="Descripción opcional" />
            <select
              name="is_required"
              defaultValue={item.is_required ? 'true' : 'false'}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="true">Requerido</option>
              <option value="false">Opcional</option>
            </select>
            <Input name="sort_order" type="number" min="0" defaultValue={item.sort_order} />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Guardar</Button>
            </div>
          </form>
          <form action={removeOperationalTemplateChecklistItemAction.bind(null, templateId, item.id)} className="mt-2">
            <Button type="submit" variant="outline" className="w-full">
              <Trash2 className="size-4" />
              Quitar
            </Button>
          </form>
        </div>
      ))}

      <form action={createOperationalTemplateChecklistItemAction.bind(null, templateId)} className="space-y-3 rounded-2xl border border-dashed border-border bg-background p-3">
        <Input name="label" placeholder="Nuevo ítem de checklist" />
        <Input name="description" placeholder="Descripción opcional" />
        <select
          name="is_required"
          defaultValue="true"
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="true">Requerido</option>
          <option value="false">Opcional</option>
        </select>
        <Input name="sort_order" type="number" min="0" defaultValue={100} />
        <Button type="submit" className="w-full">Agregar checklist</Button>
      </form>
    </div>
  );
}

function TemplateTasksColumn({
  templateId,
  items,
}: {
  templateId: string;
  items: OperationalTemplateTaskItemRecord[];
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold text-foreground">Tareas base</h3>
        <p className="text-sm text-muted-foreground">Se crean si no existen y se asignan al staff disponible del evento.</p>
      </div>

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-background p-3">
          <form action={updateOperationalTemplateTaskItemAction.bind(null, templateId, item.id)} className="space-y-3">
            <Input name="title" defaultValue={item.title} />
            <Input name="description" defaultValue={item.description ?? ''} placeholder="Descripción opcional" />
            <select
              name="priority"
              defaultValue={item.priority}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(EVENT_TASK_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              name="default_status"
              defaultValue={item.default_status}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(EVENT_TASK_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              name="assignment_role_hint"
              defaultValue={item.assignment_role_hint ?? ''}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Sin rol sugerido</option>
              {Object.entries(EVENT_ASSIGNMENT_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Input name="due_hours_before_event" type="number" min="0" defaultValue={item.due_hours_before_event ?? ''} placeholder="Horas antes del evento" />
            <Input name="suggested_phase" defaultValue={item.suggested_phase ?? ''} placeholder="Fase sugerida (opcional)" />
            <Input name="sort_order" type="number" min="0" defaultValue={item.sort_order} />
            <Input name="internal_note" defaultValue={item.internal_note ?? ''} placeholder="Nota interna opcional" />
            <Button type="submit" className="w-full">Guardar</Button>
          </form>
          <form action={removeOperationalTemplateTaskItemAction.bind(null, templateId, item.id)} className="mt-2">
            <Button type="submit" variant="outline" className="w-full">
              <Trash2 className="size-4" />
              Quitar
            </Button>
          </form>
        </div>
      ))}

      <form action={createOperationalTemplateTaskItemAction.bind(null, templateId)} className="space-y-3 rounded-2xl border border-dashed border-border bg-background p-3">
        <Input name="title" placeholder="Nueva tarea base" />
        <Input name="description" placeholder="Descripción opcional" />
        <select
          name="priority"
          defaultValue="media"
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {Object.entries(EVENT_TASK_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="default_status"
          defaultValue="pendiente"
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {Object.entries(EVENT_TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="assignment_role_hint"
          defaultValue=""
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Sin rol sugerido</option>
          {Object.entries(EVENT_ASSIGNMENT_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Input name="due_hours_before_event" type="number" min="0" placeholder="Horas antes del evento" />
        <Input name="suggested_phase" placeholder="Fase sugerida (opcional)" />
        <Input name="sort_order" type="number" min="0" defaultValue={100} />
        <Input name="internal_note" placeholder="Nota interna opcional" />
        <Button type="submit" className="w-full">Agregar tarea</Button>
      </form>
    </div>
  );
}

function TemplateMaterialsColumn({
  templateId,
  items,
}: {
  templateId: string;
  items: OperationalTemplateMaterialItemRecord[];
}) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold text-foreground">Materiales base</h3>
        <p className="text-sm text-muted-foreground">Se crean como requerimientos del evento si no estaban ligados todavía.</p>
      </div>

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-background p-3">
          <form action={updateOperationalTemplateMaterialItemAction.bind(null, templateId, item.id)} className="space-y-3">
            <Input name="name" defaultValue={item.name} placeholder="Nombre del material o insumo" />
            <Input name="material_type" defaultValue={item.material_type ?? ''} placeholder="Tipo de material (opcional)" />
            <Input name="sort_order" type="number" min="0" defaultValue={item.sort_order} />
            <Input name="note" defaultValue={item.note ?? ''} placeholder="Nota opcional" />
            <Input name="unknowns" defaultValue={item.unknowns ?? ''} placeholder="Dato pendiente por definir" />
            <select
              name="pending_definition"
              defaultValue={item.pending_definition ? 'true' : 'false'}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="false">Definido</option>
              <option value="true">Pendiente por definir</option>
            </select>
            <Button type="submit" className="w-full">Guardar</Button>
          </form>
          <form action={removeOperationalTemplateMaterialItemAction.bind(null, templateId, item.id)} className="mt-2">
            <Button type="submit" variant="outline" className="w-full">
              <Trash2 className="size-4" />
              Quitar
            </Button>
          </form>
        </div>
      ))}

      <form action={createOperationalTemplateMaterialItemAction.bind(null, templateId)} className="space-y-3 rounded-2xl border border-dashed border-border bg-background p-3">
        <Input name="name" placeholder="Nombre de material/insumo base" />
        <Input name="material_type" placeholder="Tipo de material (opcional)" />
        <Input name="sort_order" type="number" min="0" defaultValue={100} />
        <Input name="note" placeholder="Nota opcional" />
        <Input name="unknowns" placeholder="Dato pendiente por definir (opcional)" />
        <select
          name="pending_definition"
          defaultValue="false"
          className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="false">Definido</option>
          <option value="true">Pendiente por definir</option>
        </select>
        <Button type="submit" className="w-full">Agregar material</Button>
      </form>
    </div>
  );
}
