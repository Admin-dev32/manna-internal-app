import { AlertTriangle, Boxes, PackageCheck } from 'lucide-react';

import { INVENTORY_STATUS_LABELS } from '@/config/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createInventoryItemAction, updateInventoryItemAction } from '@/services/inventory/actions';
import type { LeadProfileOption } from '@/types/leads';
import type { InventoryAvailabilitySummary, InventoryItemRecord } from '@/types/inventory';

function formatQuantity(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value));
}

function getInventoryBadge(item: InventoryItemRecord, availability: InventoryAvailabilitySummary | undefined) {
  if (!item.is_active) {
    return <Badge variant="outline">Inactivo</Badge>;
  }

  if (!availability) {
    return <Badge variant="outline">Sin datos</Badge>;
  }

  if (availability.availableStock < 0) {
    return <Badge variant="warning">{INVENTORY_STATUS_LABELS.shortage}</Badge>;
  }

  if (availability.isLowStock) {
    return <Badge variant="warning">{INVENTORY_STATUS_LABELS.low}</Badge>;
  }

  return <Badge variant="success">{INVENTORY_STATUS_LABELS.healthy}</Badge>;
}

export function InventoryOverview({
  items,
  availabilityByItem,
  profiles,
}: {
  items: InventoryItemRecord[];
  availabilityByItem: Record<string, InventoryAvailabilitySummary>;
  profiles: Record<string, LeadProfileOption>;
}) {
  const lowStockItems = items.filter((item) => item.is_active && availabilityByItem[item.id]?.isLowStock).length;
  const shortageItems = items.filter((item) => item.is_active && (availabilityByItem[item.id]?.availableStock ?? 0) < 0).length;
  const activeItems = items.filter((item) => item.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Operación</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Inventario simple por evento</Badge>
        </div>
        <div className="mt-4 space-y-2">
          <h1 className="text-3xl font-semibold">Inventario</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Catálogo mínimo de materiales e insumos con stock actual, alerta visual y relación útil con eventos.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={Boxes} label="Items totales" value={items.length.toString()} />
        <SummaryCard icon={PackageCheck} label="Activos" value={activeItems.toString()} />
        <SummaryCard icon={AlertTriangle} label="Stock bajo" value={lowStockItems.toString()} />
        <SummaryCard icon={AlertTriangle} label="Faltantes" value={shortageItems.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de materiales</CardTitle>
          <CardDescription>Administra stock actual, mínimos y estado activo sin entrar todavía a movimientos complejos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length > 0 ? (
            items.map((item) => {
              const availability = availabilityByItem[item.id];
              const createdBy = profiles[item.created_by];
              const updatedBy = profiles[item.updated_by];

              return (
                <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        {getInventoryBadge(item, availability)}
                        {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Stock actual: {formatQuantity(item.current_stock)} {item.unit} · Disponible: {formatQuantity(availability?.availableStock)} {item.unit}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">Reservado: {formatQuantity(availability?.reservedStock)} {item.unit}</Badge>
                      {item.minimum_stock != null ? <Badge variant="outline">Mínimo: {formatQuantity(item.minimum_stock)} {item.unit}</Badge> : null}
                    </div>
                  </div>

                  <form action={updateInventoryItemAction.bind(null, item.id)} className="grid gap-4 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1.2fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nombre</label>
                      <Input name="name" defaultValue={item.name} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Categoría</label>
                      <Input name="category" defaultValue={item.category ?? ''} placeholder="Opcional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Unidad</label>
                      <Input name="unit" defaultValue={item.unit} placeholder="pz, caja, kg..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock actual</label>
                      <Input name="current_stock" type="number" min="0" step="0.01" defaultValue={Number(item.current_stock)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock mínimo</label>
                      <Input name="minimum_stock" type="number" min="0" step="0.01" defaultValue={item.minimum_stock ?? ''} placeholder="Opcional" />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full">Guardar</Button>
                    </div>

                    <div className="space-y-2 xl:col-span-4">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
                      <Input name="note" defaultValue={item.note ?? ''} placeholder="Contexto interno, tipo de uso o precaución" />
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                      <select
                        name="is_active"
                        defaultValue={item.is_active ? 'true' : 'false'}
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                  </form>

                  <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground md:grid-cols-2">
                    <span>Creado por: <strong className="text-foreground">{createdBy?.full_name ?? 'Usuario interno'}</strong></span>
                    <span>Última edición: <strong className="text-foreground">{updatedBy?.full_name ?? 'Usuario interno'}</strong></span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Aún no hay materiales cargados en inventario.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear item de inventario</CardTitle>
          <CardDescription>Alta mínima de materiales e insumos para luego ligarlos a eventos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createInventoryItemAction} className="grid gap-4 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nombre</label>
              <Input name="name" placeholder="Ej. Vasos compostables" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Categoría</label>
              <Input name="category" placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Unidad</label>
              <Input name="unit" placeholder="pz, caja, kg..." />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock actual</label>
              <Input name="current_stock" type="number" min="0" step="0.01" placeholder="0" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stock mínimo</label>
              <Input name="minimum_stock" type="number" min="0" step="0.01" placeholder="Opcional" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Crear</Button>
            </div>

            <div className="space-y-2 xl:col-span-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
              <Input name="note" placeholder="Contexto interno o detalle del material" />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
              <select
                name="is_active"
                defaultValue="true"
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </form>
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
  icon: typeof Boxes;
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
