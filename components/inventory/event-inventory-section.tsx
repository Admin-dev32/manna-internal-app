import { AlertTriangle, Archive, Boxes, CheckCircle2, ClipboardList, PackageCheck, ShieldAlert, ShoppingCart, Timer, Trash2, Warehouse } from 'lucide-react';

import { INVENTORY_STATUS_LABELS } from '@/config/inventory';
import { buildBarOperationalControls } from '@/lib/bar-service-operational-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { applyBarMasterTemplateToEventAction } from '@/services/bar-master-templates/actions';
import { updateBarMasterTemplateApplicationApprovalAction } from '@/services/bar-master-templates/actions';
import { createEventInventoryRequirementAction, removeEventInventoryRequirementAction, updateEventInventoryRequirementAction } from '@/services/inventory/actions';
import { reviewEventInventoryCloseoutAction, submitEventInventoryCloseoutAction } from '@/services/inventory/actions';
import { updateEventInventoryExecutionStateAction } from '@/services/inventory/actions';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateRecord,
  EventInventoryCloseoutStateRecord,
  EventInventoryExecutionStateRecord,
  EventInventoryPrepStatus,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
  InventoryItemRecord,
  InventoryStockMovementView,
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

function stockMovementTypeLabel(type: InventoryStockMovementView['movement_type']) {
  return {
    purchase_restock: 'Compra / restock',
    manual_adjustment: 'Ajuste manual',
    returned_from_event: 'Retorno de evento',
    waste_loss: 'Merma / pérdida',
  }[type];
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

type OperationalRequirement = {
  requirement: EventInventoryRequirementRecord;
  executionState: EventInventoryExecutionStateRecord | null;
  closeoutState: EventInventoryCloseoutStateRecord | null;
  item: InventoryItemRecord | undefined;
  availability: InventoryAvailabilitySummary | undefined;
  missingCounted: number;
  quantityToBuy: number;
  quantityToPull: number;
};

export function EventInventorySection({
  eventId,
  eventSummary,
  inventoryItems,
  requirements,
  executionStateByRequirement,
  closeoutStateByRequirement,
  availabilityByItem,
  recentMovements,
  profiles,
  canPrepareInventory,
  canApproveCloseout,
  barMasterTemplates,
  barMasterApplications,
  checklistProgress,
}: {
  eventId: string;
  eventSummary: {
    eventType: string | null;
    eventDate: string;
    eventTime: string;
    location: string | null;
  };
  inventoryItems: InventoryItemRecord[];
  requirements: EventInventoryRequirementRecord[];
  executionStateByRequirement: Record<string, EventInventoryExecutionStateRecord>;
  closeoutStateByRequirement: Record<string, EventInventoryCloseoutStateRecord>;
  availabilityByItem: Record<string, InventoryAvailabilitySummary>;
  recentMovements: InventoryStockMovementView[];
  profiles: Record<string, LeadProfileOption>;
  canPrepareInventory: boolean;
  canApproveCloseout: boolean;
  barMasterTemplates: BarMasterTemplateRecord[];
  barMasterApplications: BarMasterTemplateApplicationRecord[];
  checklistProgress: { total: number; completed: number; pending: number };
}) {
  const linkedItemIds = new Set(requirements.map((requirement) => requirement.inventory_item_id));
  const availableItemsToLink = inventoryItems.filter((item) => !linkedItemIds.has(item.id));
  const templateNameById = Object.fromEntries(
    barMasterTemplates.map((template) => [template.id, template.name]),
  ) as Record<string, string>;

  const operationalRows: OperationalRequirement[] = requirements.map((requirement) => {
    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === requirement.inventory_item_id);
    const availability = availabilityByItem[requirement.inventory_item_id];
    const required = Number(requirement.quantity_required ?? 0);
    const availableStock = Math.max(Number(availability?.availableStock ?? 0), 0);

    return {
      requirement,
      executionState: executionStateByRequirement[requirement.id] ?? null,
      closeoutState: closeoutStateByRequirement[requirement.id] ?? null,
      item,
      availability,
      missingCounted: calculateMissing(requirement),
      quantityToBuy: Math.max(required - availableStock, 0),
      quantityToPull: Math.max(Math.min(required, availableStock), 0),
    };
  });

  const shoppingList = operationalRows.filter((row) => row.quantityToBuy > 0);
  const pickingList = operationalRows.filter((row) => row.quantityToPull > 0);
  const shortageCount = shoppingList.length;
  const pendingPrepCount = requirements.filter((requirement) => requirement.prep_status === 'pendiente').length;
  const missingCount = operationalRows.filter((row) => row.missingCounted > 0).length;
  const readyCount = requirements.filter((requirement) => requirement.prep_status === 'listo' || requirement.prep_status === 'contado').length;
  const totalPurchaseUnits = shoppingList.reduce((acc, row) => acc + row.quantityToBuy, 0);
  const shoppingDoneCount = shoppingList.filter((row) => row.executionState?.shopping_status === 'bought').length;
  const pickingDoneCount = pickingList.filter((row) => row.executionState?.picking_status === 'pulled').length;
  const closeoutSubmittedCount = operationalRows.filter((row) => row.closeoutState?.closeout_status === 'submitted').length;
  const closeoutApprovedCount = operationalRows.filter((row) => row.closeoutState?.closeout_status === 'approved').length;
  const closeoutPendingCount = operationalRows.filter((row) => !row.closeoutState || row.closeoutState.closeout_status === 'pending' || row.closeoutState.closeout_status === 'reopened').length;
  const closeoutWasteCount = operationalRows.filter((row) => Number(row.closeoutState?.waste_quantity ?? 0) > 0).length;

  const recentTemplateNames = barMasterApplications
    .map((application) => String((application.result_summary?.applied_template_name as string | undefined) ?? '').trim())
    .filter(Boolean);
  const templateById = Object.fromEntries(
    barMasterTemplates.map((template) => [template.id, template]),
  ) as Record<string, BarMasterTemplateRecord>;
  const appliedBars = barMasterApplications.map((application) => {
    const template = templateById[application.template_id] ?? null;
    const controls = buildBarOperationalControls({
      selectedTemplate: template,
      latestApplication: application,
      requirements,
      availabilityByItem,
      executionStateByRequirement,
      checklistProgress,
    });
    const summary = application.result_summary ?? {};
    const omittedItems = Array.isArray(summary.omitted_items)
      ? summary.omitted_items.map((item) => String(item))
      : [];
    const approvalBy = application.approved_by ? profiles[application.approved_by] : null;
    const appliedBy = profiles[application.applied_by] ?? null;

    return {
      application,
      template,
      controls,
      summary: {
        totalTemplateItems: Number(summary.total_template_items ?? 0),
        linkedItemsCount: Number(summary.linked_items_count ?? 0),
        scaledItemsCount: Number(summary.scaled_items_count ?? 0),
        insertedCount: Number(summary.inserted_count ?? 0),
        updatedCount: Number(summary.updated_count ?? 0),
        skippedCount: Number(summary.skipped_without_inventory_link ?? 0),
        omittedItems,
        appliedTemplateName: String(summary.applied_template_name ?? '').trim() || template?.name || 'Barra sin nombre',
      },
      approvalBy,
      appliedBy,
    };
  });
  const appliedBarsAggregate = {
    total: appliedBars.length,
    approved: appliedBars.filter((row) => row.application.approval_status === 'approved').length,
    risk: appliedBars.filter((row) => row.controls?.readiness === 'en_riesgo').length,
    incomplete: appliedBars.filter((row) => row.controls?.readiness === 'incompleta').length,
    ready: appliedBars.filter((row) => row.controls?.readiness === 'lista_para_ejecucion').length,
  };

  const checklistCards = [
    {
      key: 'compra',
      title: 'Comprar faltantes',
      detail: `${shoppingList.length} ítem(s)`,
      tone: shoppingList.length > 0 ? 'warning' as const : 'success' as const,
      description: shoppingList.length > 0 ? `Faltan ${formatQuantity(totalPurchaseUnits)} unidades para cubrir el evento.` : 'Sin compras pendientes por ahora.',
    },
    {
      key: 'surtir',
      title: 'Surtir de bodega',
      detail: `${pickingList.length} ítem(s)`,
      tone: pickingList.length > 0 ? 'secondary' as const : 'outline' as const,
      description: 'Lista derivada de requirements y disponibilidad real en inventario general.',
    },
    {
      key: 'ubicaciones',
      title: 'Validar storage/caja',
      detail: `${operationalRows.filter((row) => !row.item?.storage_location || !row.item?.storage_box).length} sin ubicación completa`,
      tone: operationalRows.some((row) => !row.item?.storage_location || !row.item?.storage_box) ? 'warning' as const : 'success' as const,
      description: 'Confirma rutas de salida física para evitar retrasos de montaje.',
    },
    {
      key: 'conteo',
      title: 'Conteo pre-evento',
      detail: `${pendingPrepCount} pendiente(s)`,
      tone: pendingPrepCount > 0 ? 'warning' as const : 'success' as const,
      description: 'Basado en prep_status y quantity_counted de event_inventory_requirements.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operación de inventario por evento</CardTitle>
        <CardDescription>
          Inventario general como fuente madre + capa derivada del evento para Supervisor Prep y Team Leader View.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryStat icon={Archive} label="Ligados" value={requirements.length.toString()} />
          <SummaryStat icon={PackageCheck} label="Listos/contados" value={readyCount.toString()} />
          <SummaryStat icon={AlertTriangle} label="Faltantes stock" value={shortageCount.toString()} />
          <SummaryStat icon={ShieldAlert} label="Pendientes prep" value={pendingPrepCount.toString()} />
          <SummaryStat icon={Boxes} label="Con faltante conteo" value={missingCount.toString()} />
          <SummaryStat icon={ShoppingCart} label="Unidades por comprar" value={formatQuantity(totalPurchaseUnits)} />
        </div>

        {!canPrepareInventory ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Tienes visibilidad de materiales, pero no permiso para registrar conteo/preparación.
          </div>
        ) : null}

        <section className="rounded-3xl border border-border bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Supervisor Prep</h3>
              <p className="text-sm text-muted-foreground">Vista operativa para decidir compras, surtido desde bodega y estado de preparación.</p>
            </div>
            <Badge variant="outline">Evento: {eventSummary.eventType ?? 'Sin tipo'} · {eventSummary.eventDate} {eventSummary.eventTime}</Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Shopping list sincronizada</h4>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Derivada de requirements del evento + stock disponible (descontando reservas activas).</p>
              {shoppingList.length > 0 ? (
                <div className="space-y-2">
                  {shoppingList.map((row) => (
                    <div key={`buy-${row.requirement.id}`} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{row.item?.name ?? 'Material'}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="warning">Comprar {formatQuantity(row.quantityToBuy)} {row.item?.unit ?? 'u'}</Badge>
                          <Badge variant={row.executionState?.shopping_status === 'bought' ? 'success' : 'outline'}>
                            {row.executionState?.shopping_status === 'bought' ? 'Comprado' : 'Pendiente compra'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Requerido: {formatQuantity(row.requirement.quantity_required)} · Disponible: {formatQuantity(row.availability?.availableStock ?? 0)} · Reservado: {formatQuantity(row.availability?.reservedStock ?? 0)}
                      </p>
                      {canPrepareInventory ? (
                        <form
                          action={updateEventInventoryExecutionStateAction.bind(
                            null,
                            eventId,
                            row.requirement.id,
                            'shopping',
                            row.executionState?.shopping_status === 'bought' ? 'pending' : 'bought',
                          )}
                          className="mt-2"
                        >
                          <Button type="submit" size="sm" variant={row.executionState?.shopping_status === 'bought' ? 'outline' : 'default'}>
                            {row.executionState?.shopping_status === 'bought' ? 'Reabrir compra' : 'Marcar comprado'}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No hay compras pendientes según inventario general.</div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <Warehouse className="size-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Surtir desde bodega</h4>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Ítems cubiertos por stock actual y listos para retiro físico.</p>
              {pickingList.length > 0 ? (
                <div className="space-y-2">
                  {pickingList.map((row) => (
                    <div key={`pick-${row.requirement.id}`} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{row.item?.name ?? 'Material'}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Surtir {formatQuantity(row.quantityToPull)} {row.item?.unit ?? 'u'}</Badge>
                          <Badge variant={row.executionState?.picking_status === 'pulled' ? 'success' : 'outline'}>
                            {row.executionState?.picking_status === 'pulled' ? 'Surtido' : 'Pendiente surtido'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Storage: {row.item?.storage_location ?? 'Sin storage'} · Caja/bin: {row.item?.storage_box ?? 'Sin caja'}
                      </p>
                      {canPrepareInventory ? (
                        <form
                          action={updateEventInventoryExecutionStateAction.bind(
                            null,
                            eventId,
                            row.requirement.id,
                            'picking',
                            row.executionState?.picking_status === 'pulled' ? 'pending' : 'pulled',
                          )}
                          className="mt-2"
                        >
                          <Button type="submit" size="sm" variant={row.executionState?.picking_status === 'pulled' ? 'outline' : 'default'}>
                            {row.executionState?.picking_status === 'pulled' ? 'Reabrir surtido' : 'Marcar surtido'}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No hay ítems por surtir desde bodega.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Team Leader View</h3>
              <p className="text-sm text-muted-foreground">Módulos visuales para ejecución rápida en campo.</p>
            </div>
            <Badge variant="outline">{eventSummary.location ?? 'Ubicación por confirmar'}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SquareModule icon={ClipboardList} title="Resumen evento" value={eventSummary.eventType ?? 'Servicio'} subtitle={`${eventSummary.eventDate} · ${eventSummary.eventTime}`} />
            <SquareModule
              icon={ShoppingCart}
              title="Qué comprar"
              value={`${shoppingDoneCount}/${shoppingList.length || 0}`}
              subtitle={`${formatQuantity(totalPurchaseUnits)} unidades`}
              tone={shoppingList.length > 0 && shoppingDoneCount < shoppingList.length ? 'warning' : 'success'}
            />
            <SquareModule
              icon={Warehouse}
              title="Sacar de bodega"
              value={`${pickingDoneCount}/${pickingList.length || 0}`}
              subtitle="Con ubicación física"
              tone={pickingList.length > 0 && pickingDoneCount < pickingList.length ? 'warning' : 'success'}
            />
            <SquareModule icon={CheckCircle2} title="Estado prep" value={`${readyCount}/${requirements.length || 0}`} subtitle="Listos + contados" tone={pendingPrepCount > 0 ? 'warning' : 'success'} />
            <SquareModule icon={Boxes} title="Checklist barra" value={`${checklistCards.length} módulos`} subtitle="Plantillas + stock + requirements" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {checklistCards.map((item) => (
              <div key={item.key} className="rounded-2xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <Badge variant={item.tone}>{item.detail}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
            Plantillas barra aplicadas: {recentTemplateNames.length > 0 ? recentTemplateNames.slice(0, 3).join(' · ') : 'Aún no se registran aplicaciones recientes.'}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Closeout post-evento</h3>
              <p className="text-sm text-muted-foreground">Captura de sobrante, devolución y merma sin reemplazar los requirements base.</p>
            </div>
            <Badge variant="outline">Pendientes: {closeoutPendingCount}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SquareModule icon={ClipboardList} title="Pendientes cierre" value={closeoutPendingCount.toString()} subtitle="Items por cerrar" tone={closeoutPendingCount > 0 ? 'warning' : 'success'} />
            <SquareModule icon={CheckCircle2} title="En revisión" value={closeoutSubmittedCount.toString()} subtitle="Submitted" tone={closeoutSubmittedCount > 0 ? 'secondary' : 'outline'} />
            <SquareModule icon={PackageCheck} title="Aprobados" value={closeoutApprovedCount.toString()} subtitle="Closeout finalizado" tone="success" />
            <SquareModule icon={AlertTriangle} title="Con merma" value={closeoutWasteCount.toString()} subtitle="Revisar incidencias" tone={closeoutWasteCount > 0 ? 'warning' : 'outline'} />
          </div>

          <div className="mt-4 grid gap-3">
            {operationalRows.map((row) => {
              const usedCurrent = row.requirement.quantity_used != null ? Number(row.requirement.quantity_used) : null;
              const leftover = Number(row.closeoutState?.leftover_quantity ?? 0);
              const returned = Number(row.closeoutState?.returned_quantity ?? 0);
              const waste = Number(row.closeoutState?.waste_quantity ?? 0);
              const splitGap = leftover - (returned + waste);
              const closeoutStatus = row.closeoutState?.closeout_status ?? 'pending';
              const closedBy = row.closeoutState?.closed_by ? profiles[row.closeoutState.closed_by] : null;
              const reviewedBy = row.closeoutState?.reviewed_by ? profiles[row.closeoutState.reviewed_by] : null;

              return (
                <div key={`closeout-${row.requirement.id}`} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{row.item?.name ?? 'Material'}</p>
                      <p className="text-xs text-muted-foreground">
                        Requerido: {formatQuantity(row.requirement.quantity_required)} · Contado: {formatQuantity(row.requirement.quantity_counted)} · Usado: {formatQuantity(usedCurrent)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sobrante: {formatQuantity(leftover)} · Devuelto: {formatQuantity(returned)} · Merma: {formatQuantity(waste)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={closeoutStatus === 'approved' ? 'success' : closeoutStatus === 'submitted' ? 'secondary' : 'outline'}>
                        {closeoutStatus === 'approved' ? 'Aprobado' : closeoutStatus === 'submitted' ? 'En revisión' : closeoutStatus === 'reopened' ? 'Reabierto' : 'Pendiente'}
                      </Badge>
                      {splitGap !== 0 ? <Badge variant="warning">Diferencia: {formatQuantity(splitGap)}</Badge> : null}
                    </div>
                  </div>

                  {row.closeoutState?.closed_at ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Enviado por {closedBy?.full_name ?? 'usuario interno'} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.closeoutState.closed_at))}
                    </p>
                  ) : null}
                  {row.closeoutState?.reviewed_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revisado por {reviewedBy?.full_name ?? 'usuario interno'} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.closeoutState.reviewed_at))}
                    </p>
                  ) : null}

                  {canPrepareInventory ? (
                    <form action={submitEventInventoryCloseoutAction.bind(null, eventId, row.requirement.id)} className="mt-3 grid gap-3 md:grid-cols-5">
                      <Input name="quantity_used" type="number" min="0" step="0.01" defaultValue={usedCurrent ?? ''} placeholder="Usado real" />
                      <Input name="leftover_quantity" type="number" min="0" step="0.01" defaultValue={leftover} placeholder="Sobrante" />
                      <Input name="returned_quantity" type="number" min="0" step="0.01" defaultValue={returned} placeholder="Devuelto" />
                      <Input name="waste_quantity" type="number" min="0" step="0.01" defaultValue={waste} placeholder="Merma" />
                      <Button type="submit" variant="default">Enviar closeout</Button>
                      <Input name="closeout_note" defaultValue={row.closeoutState?.note ?? ''} placeholder="Nota de cierre (opcional)" className="md:col-span-5" />
                    </form>
                  ) : null}

                  {canApproveCloseout && (closeoutStatus === 'submitted' || closeoutStatus === 'approved' || closeoutStatus === 'reopened') ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={reviewEventInventoryCloseoutAction.bind(null, eventId, row.requirement.id, 'approved')}>
                        <Button type="submit" size="sm" variant={closeoutStatus === 'approved' ? 'outline' : 'default'}>
                          Aprobar closeout
                        </Button>
                      </form>
                      <form action={reviewEventInventoryCloseoutAction.bind(null, eventId, row.requirement.id, 'reopened')}>
                        <Button type="submit" size="sm" variant={closeoutStatus === 'reopened' ? 'outline' : 'secondary'}>
                          Reabrir closeout
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Ledger reciente de movimientos</h3>
              <p className="text-sm text-muted-foreground">Movimientos publicados para validar retornos/mermas y trazabilidad operativa.</p>
            </div>
            <Badge variant="outline">{recentMovements.length} registros</Badge>
          </div>

          {recentMovements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Aún no hay movimientos registrados para este evento.
            </div>
          ) : (
            <div className="space-y-2">
              {recentMovements.slice(0, 12).map((movement) => {
                const createdBy = profiles[movement.created_by];
                return (
                  <div key={movement.id} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{movement.inventory_item_name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={movement.quantity_delta >= 0 ? 'success' : 'warning'}>
                          {movement.quantity_delta >= 0 ? '+' : ''}
                          {formatQuantity(movement.quantity_delta)} {movement.inventory_item_unit}
                        </Badge>
                        <Badge variant="outline">{stockMovementTypeLabel(movement.movement_type)}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {movement.event_label ?? 'Sin contexto de evento'} · Ref: {movement.reference_type ?? 'n/a'} · Saldo item: {formatQuantity(movement.balance_after)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer className="size-3" />
                      {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.created_at))}
                      {createdBy ? ` · ${createdBy.full_name ?? 'usuario interno'}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {requirements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            Aún no hay materiales ligados a este evento.
          </div>
        ) : (
          <details className="rounded-3xl border border-border bg-background">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
              Gestión detallada de requirements (compatible con flujo actual)
            </summary>
            <div className="space-y-4 border-t border-border p-4">
              {operationalRows.map((row) => {
                const { requirement, executionState, item, availability, missingCounted: missing } = row;
                const checkedBy = requirement.checked_by ? profiles[requirement.checked_by] : null;
                const shoppingBy = executionState?.shopping_updated_by ? profiles[executionState.shopping_updated_by] : null;
                const pickingBy = executionState?.picking_updated_by ? profiles[executionState.picking_updated_by] : null;

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
                        <p className="text-xs text-muted-foreground">
                          Compra: <strong className="text-foreground">{executionState?.shopping_status === 'bought' ? 'Comprado' : 'Pendiente'}</strong> · Surtido: <strong className="text-foreground">{executionState?.picking_status === 'pulled' ? 'Surtido' : 'Pendiente'}</strong>
                        </p>
                        {requirement.source_type === 'template' ? (
                          <p className="text-xs text-muted-foreground">
                            Origen del paquete: {requirement.source_template_id ? (templateNameById[requirement.source_template_id] ?? `Template ${requirement.source_template_id.slice(0, 8)}`) : 'Plantilla sin id'}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Origen del paquete: Ajuste manual del evento</p>
                        )}
                        {item?.usage_bars ? <p className="text-xs text-muted-foreground">Uso en barras/servicios: {item.usage_bars}</p> : null}
                        {requirement.checked_at ? (
                          <p className="text-xs text-muted-foreground">
                            Último conteo: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(requirement.checked_at))}
                            {checkedBy ? ` por ${checkedBy.full_name ?? 'usuario interno'}` : ''}
                          </p>
                        ) : null}
                        {executionState?.shopping_updated_at ? (
                          <p className="text-xs text-muted-foreground">
                            Última compra marcada: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(executionState.shopping_updated_at))}
                            {shoppingBy ? ` por ${shoppingBy.full_name ?? 'usuario interno'}` : ''}
                          </p>
                        ) : null}
                        {executionState?.picking_updated_at ? (
                          <p className="text-xs text-muted-foreground">
                            Último surtido marcado: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(executionState.picking_updated_at))}
                            {pickingBy ? ` por ${pickingBy.full_name ?? 'usuario interno'}` : ''}
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
          </details>
        )}

        <div className="rounded-3xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Barras/servicios aplicados al evento</h3>
          <p className="mt-1 text-sm text-muted-foreground">Modelo de lectura multi-bar para supervisor: cada barra aplicada conserva su readiness, aprobación, guías y resultado operativo.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs">
              <p className="text-muted-foreground">Barras aplicadas</p>
              <p className="text-base font-semibold text-foreground">{appliedBarsAggregate.total}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs">
              <p className="text-muted-foreground">Aprobadas</p>
              <p className="text-base font-semibold text-foreground">{appliedBarsAggregate.approved}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs">
              <p className="text-muted-foreground">En riesgo</p>
              <p className="text-base font-semibold text-foreground">{appliedBarsAggregate.risk}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs">
              <p className="text-muted-foreground">Incompletas</p>
              <p className="text-base font-semibold text-foreground">{appliedBarsAggregate.incomplete}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-3 py-2 text-xs">
              <p className="text-muted-foreground">Listas para ejecución</p>
              <p className="text-base font-semibold text-foreground">{appliedBarsAggregate.ready}</p>
            </div>
          </div>
          {barMasterTemplates.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              No hay listas maestras activas para aplicar.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {barMasterTemplates.map((template) => {
                const templateItems = requirements.filter((requirement) => requirement.source_template_id === template.id);
                const latestForTemplate = appliedBars.find((row) => row.application.template_id === template.id) ?? null;

                return (
                  <div key={template.id} className="rounded-2xl border border-border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.service_category ?? 'Sin categoría'} · {templateItems.length} requirement(s) activos en evento</p>
                      </div>
                      {latestForTemplate?.controls
                        ? <Badge variant={latestForTemplate.controls.readiness === 'lista_para_ejecucion' ? 'success' : latestForTemplate.controls.readiness === 'en_riesgo' ? 'warning' : 'secondary'}>{latestForTemplate.controls.readinessLabel}</Badge>
                        : <Badge variant="outline">Disponible</Badge>}
                    </div>
                    <form className="mt-3" action={applyBarMasterTemplateToEventAction.bind(null, eventId, template.id)}>
                      <Button type="submit" variant={latestForTemplate ? 'secondary' : 'outline'} disabled={!canPrepareInventory} className="w-full">
                        {latestForTemplate ? 'Aplicar nuevamente esta barra' : 'Aplicar barra al evento'}
                      </Button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
          {appliedBars.length > 0 ? (
            <div className="mt-3 space-y-3">
              {appliedBars.map((row) => {
                const readinessVariant = row.controls?.readiness === 'lista_para_ejecucion'
                  ? 'success'
                  : row.controls?.readiness === 'en_riesgo'
                    ? 'warning'
                    : 'secondary';
                const approvalStatus = row.application.approval_status;
                const approvalVariant = approvalStatus === 'approved' ? 'success' : 'outline';
                const appliedAtLabel = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.application.applied_at));
                return (
                  <div key={row.application.id} className="rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{row.summary.appliedTemplateName}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={approvalVariant}>{approvalStatus === 'approved' ? 'Aprobada para ejecución' : 'No aprobada'}</Badge>
                        {row.controls ? <Badge variant={readinessVariant}>{row.controls.readinessLabel}</Badge> : null}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aplicada: {appliedAtLabel}
                      {row.appliedBy ? ` · por ${row.appliedBy.full_name ?? 'usuario interno'}` : ''}
                    </p>
                    {row.application.approved_at ? (
                      <p className="text-xs text-muted-foreground">
                        Aprobación: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.application.approved_at))}
                        {row.approvalBy ? ` · por ${row.approvalBy.full_name ?? 'usuario interno'}` : ''}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ítems plantilla: {row.summary.totalTemplateItems} · Vinculados: {row.summary.linkedItemsCount} · Escalados por invitados: {row.summary.scaledItemsCount} · Insertados: {row.summary.insertedCount} · Consolidaron: {row.summary.updatedCount} · Omitidos: {row.summary.skippedCount}
                    </p>
                    {row.summary.omittedItems.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">Omitidos: {row.summary.omittedItems.join(' · ')}</p>
                    ) : null}
                    {row.controls ? (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {row.controls.checks.map((check) => (
                          <div key={`${row.application.id}-${check.key}`} className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground">{check.label}</p>
                              <Badge variant={check.status === 'ok' ? 'success' : check.status === 'risk' ? 'warning' : 'secondary'}>
                                {check.status === 'ok' ? 'OK' : check.status === 'risk' ? 'Riesgo' : 'Pendiente'}
                              </Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">{check.detail}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:col-span-3">
                        <strong className="text-foreground">Guías:</strong>{' '}
                        Prep: {row.template?.prep_guide?.trim() || 'Sin prep'} ·
                        Ejecución: {row.template?.execution_guide?.trim() || 'Sin ejecución'} ·
                        Checklist: {row.template?.checklist_guidance?.trim() || 'Sin checklist'}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.controls?.readiness === 'en_riesgo'
                        ? 'Advertencia fuerte: barra en riesgo. Se recomienda resolver riesgos antes de aprobar.'
                        : row.controls?.readiness === 'incompleta'
                          ? 'Advertencia: barra incompleta. Recomendado completar pendientes antes de aprobar.'
                          : 'Barra lista para ejecución: aprobación recomendada.'}
                    </p>
                    <form action={updateBarMasterTemplateApplicationApprovalAction.bind(null, eventId, row.application.id)} className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
                      <Input
                        name="approval_note"
                        defaultValue={row.application.approval_note ?? ''}
                        placeholder="Nota opcional de aprobación/reapertura"
                        disabled={!canPrepareInventory}
                      />
                      <input type="hidden" name="approval_status" value="approved" />
                      <Button type="submit" disabled={!canPrepareInventory} variant={approvalStatus === 'approved' ? 'outline' : 'default'}>
                        {approvalStatus === 'approved' ? 'Actualizar aprobación' : 'Aprobar para ejecución'}
                      </Button>
                    </form>
                    <form action={updateBarMasterTemplateApplicationApprovalAction.bind(null, eventId, row.application.id)} className="mt-2">
                      <input type="hidden" name="approval_status" value="not_approved" />
                      <input type="hidden" name="approval_note" value={row.application.approval_note ?? ''} />
                      <Button type="submit" disabled={!canPrepareInventory} variant="secondary">
                        Reabrir / quitar aprobación
                      </Button>
                    </form>
                    {row.application.approval_note ? (
                      <p className="mt-2 text-xs text-muted-foreground">Nota actual: {row.application.approval_note}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Este evento aún no tiene barras aplicadas.
            </div>
          )}
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

function SquareModule({
  icon: Icon,
  title,
  value,
  subtitle,
  tone = 'outline',
}: {
  icon: typeof Archive;
  title: string;
  value: string;
  subtitle: string;
  tone?: 'outline' | 'secondary' | 'warning' | 'success';
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <Icon className="size-4 text-primary" />
        <Badge variant={tone}>{title}</Badge>
      </div>
      <p className="mt-3 text-base font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
