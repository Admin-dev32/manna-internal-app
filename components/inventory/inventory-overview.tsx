'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Boxes, PackageCheck, Search, ShoppingCart, Warehouse } from 'lucide-react';

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

function getPurchaseNeeded(item: InventoryItemRecord) {
  const target = item.ideal_stock ?? item.minimum_stock;
  if (target == null) return 0;
  return Math.max(Number(target) - Number(item.current_stock ?? 0), 0);
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low' | 'missing'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [storageFilter, setStorageFilter] = useState<'all' | string>('all');

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter((category): category is string => Boolean(category)).sort())],
    [items],
  );
  const storages = useMemo(
    () => [...new Set(items.map((item) => item.storage_location).filter((storage): storage is string => Boolean(storage)).sort())],
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const availability = availabilityByItem[item.id];
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'inactive' && item.is_active) return false;
      if (statusFilter === 'low' && !(item.is_active && availability?.isLowStock)) return false;
      if (statusFilter === 'missing' && !(item.is_active && (availability?.availableStock ?? 0) < 0)) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (storageFilter !== 'all' && item.storage_location !== storageFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        item.code,
        item.name,
        item.category,
        item.usage_bars,
        item.storage_location,
        item.storage_box,
        item.note,
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [items, availabilityByItem, search, statusFilter, categoryFilter, storageFilter]);

  const groupedItems = useMemo(
    () => Object.entries(
      filteredItems.reduce((accumulator, item) => {
        const key = item.category ?? 'Sin categoría';
        accumulator[key] = accumulator[key] ?? [];
        accumulator[key].push(item);
        return accumulator;
      }, {} as Record<string, InventoryItemRecord[]>),
    ).sort(([a], [b]) => a.localeCompare(b, 'es-MX')),
    [filteredItems],
  );

  const lowStockItems = items.filter((item) => item.is_active && availabilityByItem[item.id]?.isLowStock).length;
  const shortageItems = items.filter((item) => item.is_active && (availabilityByItem[item.id]?.availableStock ?? 0) < 0).length;
  const activeItems = items.filter((item) => item.is_active).length;
  const shoppingItems = items.filter((item) => getPurchaseNeeded(item) > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Operación</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Inventario V2</Badge>
        </div>
        <div className="mt-4 space-y-2">
          <h1 className="text-3xl font-semibold">Inventario</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Catálogo compacto con búsqueda/filtros, control de storage/caja y vista operativa para preparación y faltantes.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard icon={Boxes} label="Items totales" value={items.length.toString()} />
        <SummaryCard icon={PackageCheck} label="Activos" value={activeItems.toString()} />
        <SummaryCard icon={AlertTriangle} label="Stock bajo" value={lowStockItems.toString()} />
        <SummaryCard icon={AlertTriangle} label="Faltantes" value={shortageItems.toString()} />
        <SummaryCard icon={ShoppingCart} label="Por comprar" value={shoppingItems.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo maestro (V2)</CardTitle>
          <CardDescription>Vista compacta por categoría con filtros operativos y edición expandible por ítem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, item, barra, storage, caja..." className="pl-10" />
              </div>
            </div>
            <FilterSelect
              label="Estado"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as typeof statusFilter)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Activos' },
                { value: 'inactive', label: 'Inactivos' },
                { value: 'low', label: 'Stock bajo' },
                { value: 'missing', label: 'Faltante' },
              ]}
            />
            <FilterSelect
              label="Categoría"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value)}
              options={[{ value: 'all', label: 'Todas' }, ...categories.map((category) => ({ value: category, label: category }))]}
            />
            <FilterSelect
              label="Storage"
              value={storageFilter}
              onChange={(value) => setStorageFilter(value)}
              options={[{ value: 'all', label: 'Todos' }, ...storages.map((storage) => ({ value: storage, label: storage }))]}
            />
          </div>

          {groupedItems.length > 0 ? (
            groupedItems.map(([category, categoryItems]) => (
              <div key={category} className="rounded-2xl border border-border">
                <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{category}</p>
                  <Badge variant="outline">{categoryItems.length} ítems</Badge>
                </div>
                <div className="divide-y divide-border">
                  {categoryItems.map((item) => {
                    const availability = availabilityByItem[item.id];
                    const createdBy = profiles[item.created_by];
                    const updatedBy = profiles[item.updated_by];
                    const purchaseNeeded = getPurchaseNeeded(item);

                    return (
                      <details key={item.id} className="group px-4 py-3">
                        <summary className="cursor-pointer list-none">
                          <div className="grid gap-2 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_1fr_1fr_auto] lg:items-center">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.code ? `Código: ${item.code} · ` : ''}
                                Barra(s): {item.usage_bars ?? 'Sin definir'}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">Stock: <strong className="text-foreground">{formatQuantity(item.current_stock)} {item.unit}</strong></span>
                            <span className="text-xs text-muted-foreground">Disp.: <strong className="text-foreground">{formatQuantity(availability?.availableStock)} {item.unit}</strong></span>
                            <span className="text-xs text-muted-foreground">Por comprar: <strong className="text-foreground">{formatQuantity(purchaseNeeded)} {item.unit}</strong></span>
                            <span className="text-xs text-muted-foreground">Storage: <strong className="text-foreground">{item.storage_location ?? 'Sin definir'}</strong></span>
                            <span className="text-xs text-muted-foreground">Caja/bin: <strong className="text-foreground">{item.storage_box ?? 'Sin definir'}</strong></span>
                            <div className="flex justify-end gap-2">{getInventoryBadge(item, availability)}</div>
                          </div>
                        </summary>

                        <form action={updateInventoryItemAction.bind(null, item.id)} className="mt-4 grid gap-4 rounded-2xl border border-border bg-background/70 p-4 xl:grid-cols-[0.7fr_1.2fr_0.9fr_0.7fr_0.7fr_0.7fr]">
                          <Field label="Código"><Input name="code" defaultValue={item.code ?? ''} placeholder="SKU-001" /></Field>
                          <Field label="Item"><Input name="name" defaultValue={item.name} /></Field>
                          <Field label="Barra(s) uso"><Input name="usage_bars" defaultValue={item.usage_bars ?? ''} placeholder="Mini pancake, esquites" /></Field>
                          <Field label="Unidad"><Input name="unit" defaultValue={item.unit} placeholder="pz, caja, kg" /></Field>
                          <Field label="Stock actual"><Input name="current_stock" type="number" min="0" step="0.01" defaultValue={Number(item.current_stock)} /></Field>
                          <Field label="Stock mínimo"><Input name="minimum_stock" type="number" min="0" step="0.01" defaultValue={item.minimum_stock ?? ''} placeholder="Opcional" /></Field>

                          <Field label="Stock ideal"><Input name="ideal_stock" type="number" min="0" step="0.01" defaultValue={item.ideal_stock ?? ''} placeholder="Opcional" /></Field>
                          <Field label="Categoría"><Input name="category" defaultValue={item.category ?? ''} placeholder="Desechables, bebidas, toppings" /></Field>
                          <Field label="Storage"><Input name="storage_location" defaultValue={item.storage_location ?? ''} placeholder="Bodega principal" /></Field>
                          <Field label="Caja / bin"><Input name="storage_box" defaultValue={item.storage_box ?? ''} placeholder="Caja A-03" /></Field>
                          <Field label="Estado">
                            <select name="is_active" defaultValue={item.is_active ? 'true' : 'false'} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                              <option value="true">Activo</option>
                              <option value="false">Inactivo</option>
                            </select>
                          </Field>
                          <div className="flex items-end"><Button type="submit" className="w-full">Guardar</Button></div>

                          <div className="space-y-2 xl:col-span-6">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota operativa</label>
                            <Input name="note" defaultValue={item.note ?? ''} placeholder="Notas de almacenamiento, manipulación o uso" />
                          </div>
                        </form>

                        <div className="mt-3 grid gap-2 rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:grid-cols-2">
                          <span>Creado por: <strong className="text-foreground">{createdBy?.full_name ?? 'Usuario interno'}</strong></span>
                          <span>Última edición: <strong className="text-foreground">{updatedBy?.full_name ?? 'Usuario interno'}</strong></span>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No encontramos ítems con los filtros actuales.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear item de inventario</CardTitle>
          <CardDescription>Alta operativa con ubicación física y nivel ideal/mínimo para compras.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createInventoryItemAction} className="grid gap-4 xl:grid-cols-[0.7fr_1.2fr_0.9fr_0.7fr_0.7fr_0.7fr]">
            <Field label="Código"><Input name="code" placeholder="SKU-001" /></Field>
            <Field label="Item"><Input name="name" placeholder="Ej. Vasos compostables" /></Field>
            <Field label="Barra(s) uso"><Input name="usage_bars" placeholder="Mini pancake, esquites" /></Field>
            <Field label="Unidad"><Input name="unit" placeholder="pz, caja, kg" /></Field>
            <Field label="Stock actual"><Input name="current_stock" type="number" min="0" step="0.01" placeholder="0" /></Field>
            <Field label="Stock mínimo"><Input name="minimum_stock" type="number" min="0" step="0.01" placeholder="Opcional" /></Field>

            <Field label="Stock ideal"><Input name="ideal_stock" type="number" min="0" step="0.01" placeholder="Opcional" /></Field>
            <Field label="Categoría"><Input name="category" placeholder="Desechables, bebidas, toppings" /></Field>
            <Field label="Storage"><Input name="storage_location" placeholder="Bodega principal" /></Field>
            <Field label="Caja / bin"><Input name="storage_box" placeholder="Caja A-03" /></Field>
            <Field label="Estado">
              <select name="is_active" defaultValue="true" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Field>
            <div className="flex items-end"><Button type="submit" className="w-full">Crear</Button></div>

            <div className="space-y-2 xl:col-span-6">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota operativa</label>
              <Input name="note" placeholder="Contexto de uso, ubicación extra o cuidado especial" />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <div className="flex items-center gap-2 font-medium"><Warehouse className="size-4" />Compatibilidad operativa preservada</div>
        <p className="mt-1">Esta vista mantiene el mismo modelo base de inventario y sigue alimentando requirements por evento, preparación y tracking posterior.</p>
      </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</label>
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
