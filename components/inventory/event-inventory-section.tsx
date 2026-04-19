import { AlertTriangle, Archive, Boxes, PackageCheck, ShieldAlert, Trash2 } from 'lucide-react';

import { INVENTORY_STATUS_LABELS } from '@/config/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { applyBarMasterTemplateToEventAction } from '@/services/bar-master-templates/actions';
import { createEventInventoryRequirementAction, removeEventInventoryRequirementAction, updateEventInventoryRequirementAction } from '@/services/inventory/actions';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateRecord,
  EventInventoryPrepStatus,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
  InventoryItemRecord,
} from '@/types/inventory';
import type { LeadProfileOption } from '@/types/leads';

function formatQuantity(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value));
}

function calculateMissing(requirement: EventInventoryRequirementRecord) {
  return Math.max(Number(requirement.quantity_required) - Number(requirement.quantity_counted ?? 0), 0);
}

function prepStatusLabel(status: EventInventoryPrepStatus) {
  return {
    pendiente: 'Pendiente',
    contado: 'Contado',
    faltante: 'Faltante',
    listo: 'Listo',
  }[status];
}

function prepStatusVariant(status: EventInventoryPrepStatus) {
  if (status === 'listo') return 'success' as const;
  if (status === 'faltante') return 'warning' as const;
  if (status === 'contado') return 'secondary' as const;
  return 'outline' as const;
}

function getInventoryBadge(availability: InventoryAvailabilitySummary | undefined, requiredQuantity?: number) {
  if (!availability) {
    return <Badge variant="outline">Sin stock</Badge>;
  }

  if (requiredQuantity != null && availability.availableStock < requiredQuantity) {
    return <Badge variant="warning">{INVENTORY_STATUS_LABELS.shortage}</Badge>;
  }

  if (availability.isLowStock) {
    return <Badge variant="warning">{INVENTORY_STATUS_LABELS.low}</Badge>;
  }

  return <Badge variant="success">{INVENTORY_STATUS_LABELS.healthy}</Badge>;
}

export function EventInventorySection({
  eventId,
  inventoryItems,
  requirements,
  availabilityByItem,
  profiles,
  canPrepareInventory,
  barMasterTemplates,
  barMasterApplications,
}: {
  eventId: string;
  inventoryItems: InventoryItemRecord[];
  requirements: EventInventoryRequirementRecord[];
  availabilityByItem: Record<string, InventoryAvailabilitySummary>;
  profiles: Record<string, LeadProfileOption>;
  canPrepareInventory: boolean;
  barMasterTemplates: BarMasterTemplateRecord[];
  barMasterApplications: BarMasterTemplateApplicationRecord[];
}) {
  const linkedItemIds = new Set(requirements.map((requirement) => requirement.inventory_item_id));
  const availableItemsToLink = inventoryItems.filter((item) => !linkedItemIds.has(item.id));
  const shortageCount = requirements.filter((requirement) => {
    const availability = availabilityByItem[requirement.inventory_item_id];
    return availability ? availability.availableStock < requirement.quantity_required : true;
  }).length;
  const pendingPrepCount = requirements.filter((requirement) => requirement.prep_status === 'pendiente').length;
  const missingCount = requirements.filter((requirement) => calculateMissing(requirement) > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Materiales e insumos</CardTitle>
        <CardDescription>
          Base reusable: plantillas operativas por barra/servicio. Instancia real: requirements de este evento con conteo y preparación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <SummaryStat icon={Archive} label="Ligados" value={requirements.length.toString()} />
          <SummaryStat icon={PackageCheck} label="Disponibles" value={(requirements.length - shortageCount).toString()} />
          <SummaryStat icon={AlertTriangle} label="Faltantes stock" value={shortageCount.toString()} />
          <SummaryStat icon={ShieldAlert} label="Pendientes prep" value={pendingPrepCount.toString()} />
          <SummaryStat icon={Boxes} label="Con faltante conteo" value={missingCount.toString()} />
        </div>

        {!canPrepareInventory ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Tienes visibilidad de materiales, pero no permiso para registrar conteo/preparación.
          </div>
        ) : null}

        {requirements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Aún no hay materiales ligados a este evento.
          </div>
        ) : (
          <div className="space-y-4">
            {requirements.map((requirement) => {
              const item = inventoryItems.find((inventoryItem) => inventoryItem.id === requirement.inventory_item_id);
              const availability = availabilityByItem[requirement.inventory_item_id];
              const missing = calculateMissing(requirement);
              const checkedBy = requirement.checked_by ? profiles[requirement.checked_by] : null;

              return (
                <div key={requirement.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{item?.name ?? 'Material'}</p>
                        {getInventoryBadge(availability, Number(requirement.quantity_required))}
                        <Badge variant={prepStatusVariant(requirement.prep_status)}>{prepStatusLabel(requirement.prep_status)}</Badge>
                        <Badge variant="outline">{requirement.source_type === 'template' ? 'Base plantilla' : 'Manual evento'}</Badge>
                        {item?.category ? <Badge variant="outline">{item.category}</Badge> : null}
                        {item?.storage_location ? <Badge variant="outline">Storage: {item.storage_location}</Badge> : null}
                        {item?.storage_box ? <Badge variant="outline">Caja/bin: {item.storage_box}</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requerido: {formatQuantity(requirement.quantity_required)} {item?.unit ?? 'u'} · Contado: {formatQuantity(requirement.quantity_counted)} {item?.unit ?? 'u'} · Faltante: {formatQuantity(missing)} {item?.unit ?? 'u'}
                      </p>
                      {item?.usage_bars ? <p className="text-xs text-muted-foreground">Uso en barras/servicios: {item.usage_bars}</p> : null}
                      {requirement.checked_at ? (
                        <p className="text-xs text-muted-foreground">
                          Último conteo: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(requirement.checked_at))}
                          {checkedBy ? ` por ${checkedBy.full_name ?? 'usuario interno'}` : ''}
                        </p>
                      ) : null}
                    </div>
                    {canPrepareInventory ? (
                      <form action={removeEventInventoryRequirementAction.bind(null, eventId, requirement.id)}>
                        <Button type="submit" variant="outline">
                          <Trash2 className="size-4" />
                          Quitar
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  <form action={updateEventInventoryRequirementAction.bind(null, eventId, requirement.id)} className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Material</label>
                      <select
                        name="inventory_item_id"
                        defaultValue={requirement.inventory_item_id}
                        disabled={!canPrepareInventory}
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {inventoryItems.map((inventoryItem) => (
                          <option key={inventoryItem.id} value={inventoryItem.id}>
                            {inventoryItem.name} · {inventoryItem.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad requerida</label>
                      <Input name="quantity_required" type="number" min="0" step="0.01" defaultValue={Number(requirement.quantity_required)} disabled={!canPrepareInventory} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad contada</label>
                      <Input name="quantity_counted" type="number" min="0" step="0.01" defaultValue={requirement.quantity_counted ?? ''} placeholder="Conteo real" disabled={!canPrepareInventory} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad usada</label>
                      <Input name="quantity_used" type="number" min="0" step="0.01" defaultValue={requirement.quantity_used ?? ''} placeholder="Opcional" disabled={!canPrepareInventory} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado prep</label>
                      <select
                        name="prep_status"
                        defaultValue={requirement.prep_status}
                        disabled={!canPrepareInventory}
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="contado">Contado</option>
                        <option value="faltante">Faltante</option>
                        <option value="listo">Listo</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <Button type="submit" className="w-full" disabled={!canPrepareInventory}>
                        Guardar
                      </Button>
                    </div>

                    <div className="space-y-2 xl:col-span-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota general</label>
                      <Input name="note" defaultValue={requirement.note ?? ''} placeholder="Ej. reservar para montaje principal" disabled={!canPrepareInventory} />
                    </div>

                    <div className="space-y-2 xl:col-span-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota de preparación</label>
                      <Input name="prep_notes" defaultValue={requirement.prep_notes ?? ''} placeholder="Ej. faltan 2 cajas, proveedor confirma entrega mañana" disabled={!canPrepareInventory} />
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Aplicar lista maestra por barra</h3>
          <p className="mt-1 text-sm text-muted-foreground">Siembra materiales base al evento y consolida cantidades sin duplicar requirements existentes.</p>
          {barMasterTemplates.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              No hay listas maestras activas para aplicar.
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {barMasterTemplates.slice(0, 6).map((template) => (
                <form key={template.id} action={applyBarMasterTemplateToEventAction.bind(null, eventId, template.id)}>
                  <Button type="submit" variant="outline" disabled={!canPrepareInventory}>
                    Aplicar: {template.name}
                  </Button>
                </form>
              ))}
            </div>
          )}
          {barMasterApplications.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              Últimas aplicaciones: {barMasterApplications.slice(0, 3).map((application) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(application.applied_at))).join(' · ')}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Agregar material al evento</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea requirements reales del evento (manuales o provenientes de plantilla) para preparar conteo operativo.</p>
          {availableItemsToLink.length > 0 ? (
            <form action={createEventInventoryRequirementAction.bind(null, eventId)} className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Material</label>
                <select
                  name="inventory_item_id"
                  defaultValue={availableItemsToLink[0]?.id ?? ''}
                  disabled={!canPrepareInventory}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {availableItemsToLink.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Stock {formatQuantity(availabilityByItem[item.id]?.availableStock ?? item.current_stock)} {item.unit} · {item.storage_location ?? 'Sin storage'} / {item.storage_box ?? 'Sin caja'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad requerida</label>
                <Input name="quantity_required" type="number" min="0" step="0.01" placeholder="0" disabled={!canPrepareInventory} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad contada</label>
                <Input name="quantity_counted" type="number" min="0" step="0.01" placeholder="Opcional" disabled={!canPrepareInventory} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad usada</label>
                <Input name="quantity_used" type="number" min="0" step="0.01" placeholder="Opcional" disabled={!canPrepareInventory} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado prep</label>
                <select name="prep_status" defaultValue="pendiente" disabled={!canPrepareInventory} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  <option value="pendiente">Pendiente</option>
                  <option value="contado">Contado</option>
                  <option value="faltante">Faltante</option>
                  <option value="listo">Listo</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={!canPrepareInventory}>
                  Agregar
                </Button>
              </div>

              <div className="space-y-2 xl:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota general</label>
                <Input name="note" placeholder="Ej. reservar para montaje principal" disabled={!canPrepareInventory} />
              </div>

              <div className="space-y-2 xl:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota de preparación</label>
                <Input name="prep_notes" placeholder="Ej. conteo parcial en bodega" disabled={!canPrepareInventory} />
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No hay más materiales activos disponibles para ligar a este evento.
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
  icon: typeof Archive;
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
