import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createBarMasterTemplateAction,
  createBarMasterTemplateItemAction,
  updateBarMasterTemplateAction,
  updateBarMasterTemplateItemAction,
} from '@/services/bar-master-templates/actions';
import type { BarMasterTemplateItemRecord, BarMasterTemplateRecord, InventoryItemRecord } from '@/types/inventory';
import type { LeadProfileOption } from '@/types/leads';

export function BarMasterTemplatesManager({
  templates,
  items,
  inventoryItems,
  profiles,
  canManage,
}: {
  templates: BarMasterTemplateRecord[];
  items: BarMasterTemplateItemRecord[];
  inventoryItems: InventoryItemRecord[];
  profiles: Record<string, LeadProfileOption>;
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-panel sm:p-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">Listas maestras reutilizables por barra</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">Capa de inventario reutilizable que siembra requirements reales por evento, sin mezclar checklist/tareas de plantillas operativas.</p>
      </section>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear lista maestra</CardTitle>
            <CardDescription>Define la base de materiales por barra y luego agrega sus ítems.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createBarMasterTemplateAction} className="grid gap-4 xl:grid-cols-[1.1fr_1fr_auto]">
              <Input name="name" placeholder="Ej. Base Mini Pancake Bar" />
              <Input name="service_category" placeholder="Ej. mini-pancake-bar" />
              <select name="is_active" defaultValue="true" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
              <Textarea name="description" rows={2} placeholder="Descripción corta" className="xl:col-span-2" />
              <Textarea name="note" rows={2} placeholder="Nota opcional" className="xl:col-span-2" />
              <div className="flex items-end"><Button type="submit" className="w-full">Crear</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {templates.map((template) => {
        const templateItems = items.filter((item) => item.template_id === template.id);
        return (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>{template.service_category ?? 'Sin categoría'} · {templateItems.length} ítems</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateBarMasterTemplateAction.bind(null, template.id)} className="grid gap-4 xl:grid-cols-[1.1fr_1fr_auto]">
                <Input name="name" defaultValue={template.name} disabled={!canManage} />
                <Input name="service_category" defaultValue={template.service_category ?? ''} disabled={!canManage} />
                <select name="is_active" defaultValue={template.is_active ? 'true' : 'false'} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
                <Textarea name="description" rows={2} defaultValue={template.description ?? ''} disabled={!canManage} className="xl:col-span-2" />
                <Textarea name="note" rows={2} defaultValue={template.note ?? ''} disabled={!canManage} className="xl:col-span-2" />
                {canManage ? <div className="flex items-end"><Button type="submit" className="w-full">Guardar base</Button></div> : null}
              </form>

              <div className="space-y-3">
                {templateItems.map((item) => (
                  <form key={item.id} action={updateBarMasterTemplateItemAction.bind(null, template.id, item.id)} className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 xl:grid-cols-6">
                    <Input name="item_name" defaultValue={item.item_name} disabled={!canManage} />
                    <select name="inventory_item_id" defaultValue={item.inventory_item_id ?? ''} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="">Sin vínculo a catálogo</option>
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}</option>
                      ))}
                    </select>
                    <Input name="unit" defaultValue={item.unit ?? ''} placeholder="Unidad" disabled={!canManage} />
                    <Input name="quantity_required" type="number" min="0" step="0.01" defaultValue={Number(item.quantity_required)} disabled={!canManage} />
                    <Input name="sort_order" type="number" min="0" defaultValue={item.sort_order} disabled={!canManage} />
                    <select name="is_active" defaultValue={item.is_active ? 'true' : 'false'} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                    <Input name="note" defaultValue={item.note ?? ''} placeholder="Nota" className="xl:col-span-5" disabled={!canManage} />
                    {canManage ? <Button type="submit">Guardar ítem</Button> : null}
                  </form>
                ))}

                {canManage ? (
                  <form action={createBarMasterTemplateItemAction.bind(null, template.id)} className="grid gap-3 rounded-2xl border border-dashed border-border p-3 xl:grid-cols-6">
                    <Input name="item_name" placeholder="Nuevo material" />
                    <select name="inventory_item_id" defaultValue="" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="">Sin vínculo a catálogo</option>
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}</option>
                      ))}
                    </select>
                    <Input name="unit" placeholder="Unidad" />
                    <Input name="quantity_required" type="number" min="0" step="0.01" placeholder="Cantidad" />
                    <Input name="sort_order" type="number" min="0" defaultValue={100} />
                    <select name="is_active" defaultValue="true" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                    <Input name="note" placeholder="Nota" className="xl:col-span-5" />
                    <Button type="submit">Agregar ítem</Button>
                  </form>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">Creado por {profiles[template.created_by]?.full_name ?? 'usuario interno'} · Última edición {profiles[template.updated_by]?.full_name ?? 'usuario interno'}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
