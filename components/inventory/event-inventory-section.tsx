import { AlertTriangle, Archive, Boxes, PackageCheck, Trash2 } from 'lucide-react';

import { INVENTORY_STATUS_LABELS } from '@/config/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createEventInventoryRequirementAction, removeEventInventoryRequirementAction, updateEventInventoryRequirementAction } from '@/services/inventory/actions';
import type { EventInventoryRequirementRecord, InventoryAvailabilitySummary, InventoryItemRecord } from '@/types/inventory';

function formatQuantity(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value));
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
}: {
  eventId: string;
  inventoryItems: InventoryItemRecord[];
  requirements: EventInventoryRequirementRecord[];
  availabilityByItem: Record<string, InventoryAvailabilitySummary>;
}) {
  const linkedItemIds = new Set(requirements.map((requirement) => requirement.inventory_item_id));
  const availableItemsToLink = inventoryItems.filter((item) => !linkedItemIds.has(item.id));
  const shortageCount = requirements.filter((requirement) => {
    const availability = availabilityByItem[requirement.inventory_item_id];
    return availability ? availability.availableStock < requirement.quantity_required : true;
  }).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Materiales e insumos</CardTitle>
        <CardDescription>Base mínima para saber qué requiere el evento y si el stock alcanza.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <SummaryStat icon={Archive} label="Ligados" value={requirements.length.toString()} />
          <SummaryStat icon={PackageCheck} label="Disponibles" value={(requirements.length - shortageCount).toString()} />
          <SummaryStat icon={AlertTriangle} label="Faltantes" value={shortageCount.toString()} />
          <SummaryStat icon={Boxes} label="Catálogo activo" value={inventoryItems.length.toString()} />
        </div>

        {requirements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Aún no hay materiales ligados a este evento.
          </div>
        ) : (
          <div className="space-y-4">
            {requirements.map((requirement) => {
              const item = inventoryItems.find((inventoryItem) => inventoryItem.id === requirement.inventory_item_id);
              const availability = availabilityByItem[requirement.inventory_item_id];

              return (
                <div key={requirement.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{item?.name ?? 'Material'}</p>
                        {getInventoryBadge(availability, Number(requirement.quantity_required))}
                        {item?.category ? <Badge variant="outline">{item.category}</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requerido: {formatQuantity(requirement.quantity_required)} {item?.unit ?? 'u'} · Disponible: {formatQuantity(availability?.availableStock)} {item?.unit ?? 'u'}
                      </p>
                    </div>
                    <form action={removeEventInventoryRequirementAction.bind(null, eventId, requirement.id)}>
                      <Button type="submit" variant="outline">
                        <Trash2 className="size-4" />
                        Quitar
                      </Button>
                    </form>
                  </div>

                  <form action={updateEventInventoryRequirementAction.bind(null, eventId, requirement.id)} className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Material</label>
                      <select
                        name="inventory_item_id"
                        defaultValue={requirement.inventory_item_id}
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
                      <Input name="quantity_required" type="number" min="0" step="0.01" defaultValue={Number(requirement.quantity_required)} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad usada</label>
                      <Input name="quantity_used" type="number" min="0" step="0.01" defaultValue={requirement.quantity_used ?? ''} placeholder="Opcional" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
                      <Input name="note" defaultValue={requirement.note ?? ''} placeholder="Ej. llevar caja extra por seguridad" />
                    </div>

                    <div className="flex items-end">
                      <Button type="submit" className="w-full">
                        Guardar
                      </Button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Agregar material al evento</h3>
          <p className="mt-1 text-sm text-muted-foreground">Relaciona insumos existentes con este evento para comparar requerido contra stock disponible.</p>
          {availableItemsToLink.length > 0 ? (
            <form action={createEventInventoryRequirementAction.bind(null, eventId)} className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Material</label>
                <select
                  name="inventory_item_id"
                  defaultValue={availableItemsToLink[0]?.id ?? ''}
                  className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {availableItemsToLink.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Stock {formatQuantity(availabilityByItem[item.id]?.availableStock ?? item.current_stock)} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad requerida</label>
                <Input name="quantity_required" type="number" min="0" step="0.01" placeholder="0" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Cantidad usada</label>
                <Input name="quantity_used" type="number" min="0" step="0.01" placeholder="Opcional" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
                <Input name="note" placeholder="Ej. reservar para montaje principal" />
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Agregar
                </Button>
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
