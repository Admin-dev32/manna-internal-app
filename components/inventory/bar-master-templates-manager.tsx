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
  const inventoryById = Object.fromEntries(inventoryItems.map((inventoryItem) => [inventoryItem.id, inventoryItem])) as Record<string, InventoryItemRecord>;

  function itemTypeLabel(value: 'ingrediente' | 'herramienta' | 'apoyo') {
    return value === 'ingrediente' ? 'Ingrediente / consumible' : value === 'herramienta' ? 'Herramienta reutilizable' : 'Artículo de apoyo';
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-panel sm:p-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">Servicios / barras (definición manual)</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">Base principal para configurar manualmente cada servicio/barra y sus ítems conectados al inventario real.</p>
      </section>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear servicio/barra</CardTitle>
            <CardDescription>Define guía operativa y luego agrega ingredientes, herramientas y artículos de apoyo.</CardDescription>
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
              <Textarea name="prep_guide" rows={3} placeholder="Guía de preparación" className="xl:col-span-3" />
              <Textarea name="execution_guide" rows={3} placeholder="Guía de ejecución" className="xl:col-span-3" />
              <Textarea name="checklist_guidance" rows={3} placeholder="Checklist guidance / validaciones clave" className="xl:col-span-3" />
              <select name="enforce_inventory_links" defaultValue="true" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm xl:col-span-2">
                <option value="true">Requerir vínculo a inventario</option>
                <option value="false">Permitir ítems sin vínculo (temporal)</option>
              </select>
              <div className="flex items-end"><Button type="submit" className="w-full">Crear</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {templates.map((template) => {
        const templateItems = items.filter((item) => item.template_id === template.id);
        const ingredientCount = templateItems.filter((item) => item.item_type === 'ingrediente').length;
        const toolCount = templateItems.filter((item) => item.item_type === 'herramienta').length;
        const supportCount = templateItems.filter((item) => item.item_type === 'apoyo').length;
        const unlinkedCount = templateItems.filter((item) => !item.inventory_item_id && item.is_active).length;
        return (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
              <CardDescription>
                {template.service_category ?? 'Sin categoría'} · {templateItems.length} ítems · Ingredientes: {ingredientCount} · Herramientas: {toolCount} · Apoyo: {supportCount}
                {unlinkedCount > 0 ? ` · Sin vínculo inventario: ${unlinkedCount}` : ''}
              </CardDescription>
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
                <Textarea name="prep_guide" rows={3} defaultValue={template.prep_guide ?? ''} disabled={!canManage} className="xl:col-span-3" />
                <Textarea name="execution_guide" rows={3} defaultValue={template.execution_guide ?? ''} disabled={!canManage} className="xl:col-span-3" />
                <Textarea name="checklist_guidance" rows={3} defaultValue={template.checklist_guidance ?? ''} disabled={!canManage} className="xl:col-span-3" />
                <select name="enforce_inventory_links" defaultValue={template.enforce_inventory_links ? 'true' : 'false'} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm xl:col-span-2">
                  <option value="true">Requerir vínculo a inventario</option>
                  <option value="false">Permitir ítems sin vínculo (temporal)</option>
                </select>
                {canManage ? <div className="flex items-end"><Button type="submit" className="w-full">Guardar base</Button></div> : null}
              </form>

              <div className="space-y-3">
                {templateItems.map((item) => (
                  <form key={item.id} action={updateBarMasterTemplateItemAction.bind(null, template.id, item.id)} className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 xl:grid-cols-6">
                    <select name="item_type" defaultValue={item.item_type} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="ingrediente">Ingrediente / consumible</option>
                      <option value="herramienta">Herramienta reutilizable</option>
                      <option value="apoyo">Artículo de apoyo</option>
                    </select>
                    <Input name="item_name" defaultValue={item.item_name} disabled={!canManage} />
                    <select name="inventory_item_id" defaultValue={item.inventory_item_id ?? ''} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="">Sin vínculo a catálogo</option>
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}</option>
                      ))}
                    </select>
                    <Input name="unit" defaultValue={item.unit ?? ''} placeholder="Unidad" disabled={!canManage} />
                    <Input name="quantity_required" type="number" min="0" step="0.01" defaultValue={Number(item.quantity_required)} disabled={!canManage} />
                    <Input name="base_servings" type="number" min="1" step="1" defaultValue={item.base_servings ?? ''} placeholder="Base personas (escala)" disabled={!canManage} />
                    <Input name="scale_rounding_step" type="number" min="0.01" step="0.01" defaultValue={item.scale_rounding_step ?? ''} placeholder="Paso redondeo" disabled={!canManage} />
                    <Input name="sort_order" type="number" min="0" defaultValue={item.sort_order} disabled={!canManage} />
                    <select name="is_active" defaultValue={item.is_active ? 'true' : 'false'} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                    <select name="is_optional" defaultValue={item.is_optional ? 'true' : 'false'} disabled={!canManage} className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="false">Requerido</option>
                      <option value="true">Opcional</option>
                    </select>
                    <Input name="note" defaultValue={item.note ?? ''} placeholder="Nota" className="xl:col-span-5" disabled={!canManage} />
                    {canManage ? <Button type="submit">Guardar ítem</Button> : null}
                    <p className="text-xs text-muted-foreground xl:col-span-6">
                      Tipo: {itemTypeLabel(item.item_type)} · Vínculo inventario: {item.inventory_item_id ? 'Conectado' : template.enforce_inventory_links ? 'Falta conexión (requerida)' : 'Sin conexión (permitido temporal)'}
                      {item.base_servings ? ` · Escala: ${Number(item.quantity_required)} para ${item.base_servings} personas` : ' · Escala: fija (sin guest_count)'}
                      {item.scale_rounding_step ? ` · Redondeo: ${item.scale_rounding_step}` : ''}
                      {item.inventory_item_id && inventoryById[item.inventory_item_id]
                        ? ` · Stock: ${inventoryById[item.inventory_item_id].current_stock} ${inventoryById[item.inventory_item_id].unit} · Storage: ${inventoryById[item.inventory_item_id].storage_location ?? 'Sin storage'} / ${inventoryById[item.inventory_item_id].storage_box ?? 'Sin caja'}`
                        : ''}
                    </p>
                  </form>
                ))}

                {canManage ? (
                  <form action={createBarMasterTemplateItemAction.bind(null, template.id)} className="grid gap-3 rounded-2xl border border-dashed border-border p-3 xl:grid-cols-6">
                    <select name="item_type" defaultValue="ingrediente" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="ingrediente">Ingrediente / consumible</option>
                      <option value="herramienta">Herramienta reutilizable</option>
                      <option value="apoyo">Artículo de apoyo</option>
                    </select>
                    <Input name="item_name" placeholder="Nuevo material" />
                    <select name="inventory_item_id" defaultValue="" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="">Sin vínculo a catálogo</option>
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name}</option>
                      ))}
                    </select>
                    <Input name="unit" placeholder="Unidad" />
                    <Input name="quantity_required" type="number" min="0" step="0.01" placeholder="Cantidad" />
                    <Input name="base_servings" type="number" min="1" step="1" placeholder="Base personas (opcional)" />
                    <Input name="scale_rounding_step" type="number" min="0.01" step="0.01" placeholder="Paso redondeo (opcional)" />
                    <Input name="sort_order" type="number" min="0" defaultValue={100} />
                    <select name="is_active" defaultValue="true" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                    <select name="is_optional" defaultValue="false" className="flex h-11 rounded-2xl border border-input bg-background px-4 text-sm">
                      <option value="false">Requerido</option>
                      <option value="true">Opcional</option>
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
