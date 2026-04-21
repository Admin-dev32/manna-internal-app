'use client';

import { useActionState, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { CheckCircle2, Circle, ClipboardList, Package, ShoppingCart, Truck } from 'lucide-react';

import { TEAM_LEADER_QC_CHECKPOINT_LABELS, TEAM_LEADER_QC_CHECKPOINT_LOG_ACTION_LABELS, TEAM_LEADER_QC_CHECKPOINT_STATUS_LABELS } from '@/config/employees';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { TeamLeaderExecutionContext } from '@/types/employees';

function formatDateTime(date: string, time: string) {
  const formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date(`${date}T00:00:00.000Z`));
  return `${formattedDate} · ${String(time).slice(0, 5)}`;
}

function qty(value: number | null | undefined) {
  if (value == null) return '0';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value));
}

export function TeamLeaderExecutionPanel({
  context,
  updateExecutionAction,
  toggleChecklistAction,
  submitCloseoutAction,
  submitQcCheckpointAction,
}: {
  context: TeamLeaderExecutionContext;
  updateExecutionAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  toggleChecklistAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  submitCloseoutAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  submitQcCheckpointAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [executionState, executionFormAction] = useActionState(updateExecutionAction, initialEmployeeActionFormState);
  const [checklistState, checklistFormAction] = useActionState(toggleChecklistAction, initialEmployeeActionFormState);
  const [closeoutState, closeoutFormAction] = useActionState(submitCloseoutAction, initialEmployeeActionFormState);
  const [qcState, qcFormAction] = useActionState(submitQcCheckpointAction, initialEmployeeActionFormState);
  const [barFilter, setBarFilter] = useState<string>('all');

  const checklistDone = context.checklistItems.filter((item) => item.is_completed).length;
  const filteredShoppingList = useMemo(
    () => (barFilter === 'all' ? context.shoppingList : context.shoppingList.filter((row) => row.requirement.source_template_id === barFilter)),
    [barFilter, context.shoppingList],
  );
  const filteredPickingList = useMemo(
    () => (barFilter === 'all' ? context.pickingList : context.pickingList.filter((row) => row.requirement.source_template_id === barFilter)),
    [barFilter, context.pickingList],
  );
  const filteredCloseoutRows = useMemo(
    () => (barFilter === 'all'
      ? [...context.shoppingList, ...context.pickingList]
      : [...context.shoppingList, ...context.pickingList].filter((row) => row.requirement.source_template_id === barFilter)),
    [barFilter, context.pickingList, context.shoppingList],
  );
  const recaptureQueue = context.qcCheckpoints.filter((item) => item.status === 'observed');

  return (
    <section className="space-y-4">
      <Card className="rounded-3xl border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl">Team Leader · Ejecución de evento</CardTitle>
          <CardDescription>Vista enfocada para ejecutar tu evento asignado sin navegar el panel administrativo completo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">{context.event.event_type ?? 'Evento'} #{context.event.id.slice(0, 8)}</p>
          <p className="text-muted-foreground">{formatDateTime(context.event.event_date, context.event.event_time)}</p>
          <p className="text-muted-foreground">{context.event.location ?? 'Dirección pendiente'}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Servicio: {context.event.booked_service}</Badge>
            <Badge variant="secondary">Barras aplicadas: {context.barAggregate.total}</Badge>
            <Badge variant={context.barAggregate.risk > 0 ? 'warning' : 'success'}>En riesgo: {context.barAggregate.risk}</Badge>
            <Badge variant={context.barAggregate.ready > 0 ? 'success' : 'outline'}>Listas: {context.barAggregate.ready}</Badge>
            <Badge variant={context.handoffStatus === 'handed_off' ? 'success' : context.handoffStatus === 'ready_for_handoff' ? 'secondary' : 'outline'}>
              Handoff: {context.handoffStatus === 'handed_off' ? 'Realizado' : context.handoffStatus === 'ready_for_handoff' ? 'Listo' : 'Draft'}
            </Badge>
          </div>
          {context.handoffNote ? <p className="text-xs text-muted-foreground">Nota handoff: {context.handoffNote}</p> : null}
          {context.barServices.length > 0 ? (
            <div className="rounded-2xl border border-primary/20 bg-background px-3 py-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Barras aplicadas · Vista multi-bar</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {context.barServices.map((bar) => (
                  <button
                    key={bar.applicationId}
                    type="button"
                    onClick={() => setBarFilter((current) => (current === bar.templateId ? 'all' : bar.templateId))}
                    className="rounded-xl border border-border bg-muted/20 px-2 py-2 text-left"
                  >
                    <p className="font-medium text-foreground">{bar.templateName}</p>
                    <p className="text-[11px]">
                      Readiness: {bar.readinessLabel} · {bar.approvalStatus === 'approved' ? 'Aprobada' : 'No aprobada'}
                    </p>
                    <p className="text-[11px]">
                      Riesgos/Pendientes: {bar.checks.filter((check) => check.status === 'risk').length} riesgo · {bar.checks.filter((check) => check.status === 'warning').length} pendiente
                    </p>
                    <p className="text-[11px]">
                      Ítems: {bar.summary.totalTemplateItems} · Escalados: {bar.summary.scaledItemsCount} · Omitidos: {bar.summary.skippedCount} · Insertados: {bar.summary.insertedCount}
                    </p>
                    <p className="text-[11px]">
                      Guías: Prep {bar.prepGuide?.trim() ? '✓' : '—'} · Ejecución {bar.executionGuide?.trim() ? '✓' : '—'} · Checklist {bar.checklistGuidance?.trim() ? '✓' : '—'}
                    </p>
                    <p className="text-[11px]">Aplicada: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(bar.appliedAt))}</p>
                    <p className="text-[11px]">{bar.approvalNote ? `Nota: ${bar.approvalNote}` : 'Sin nota de aprobación'}</p>
                    <p className="text-[11px] text-primary">{barFilter === bar.templateId ? 'Filtro activo en listas operativas' : 'Click para filtrar listas por esta barra'}</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Filtro actual: {barFilter === 'all' ? 'Todas las barras' : (context.barServices.find((bar) => bar.templateId === barFilter)?.templateName ?? 'Barra filtrada')}
              </p>
              <div className="mt-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
                <p className="font-medium text-foreground">Snapshot de handoff multi-bar</p>
                <p className="mt-1 text-[11px]">
                  Agregado: total {context.handoffSnapshot.aggregate.total} · aprobadas {context.handoffSnapshot.aggregate.approved} · listas {context.handoffSnapshot.aggregate.ready} · riesgo {context.handoffSnapshot.aggregate.risk} · incompletas {context.handoffSnapshot.aggregate.incomplete}
                </p>
                <pre className="mt-1 whitespace-pre-wrap text-[11px]">{context.handoffSnapshot.text}</pre>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat icon={ShoppingCart} label="Compras" value={`${filteredShoppingList.filter((r) => r.executionState?.shopping_status === 'bought').length}/${filteredShoppingList.length}`} />
        <MiniStat icon={Package} label="Surtido" value={`${filteredPickingList.filter((r) => r.executionState?.picking_status === 'pulled').length}/${filteredPickingList.length}`} />
        <MiniStat icon={ClipboardList} label="Checklist" value={`${checklistDone}/${context.checklistItems.length}`} />
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Quality Control · Checkpoints</CardTitle>
          <CardDescription>Secuencia operativa de evidencia obligatoria para Team Leader en campo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recaptureQueue.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-900">Cola de recapturas pendiente</p>
              <p className="text-amber-800">Tienes {recaptureQueue.length} checkpoint(s) observado(s). Reenvía evidencia actualizada para volver a revisión.</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-900">
                {recaptureQueue.map((item) => (
                  <li key={`recapture-${item.id}`}>• {TEAM_LEADER_QC_CHECKPOINT_LABELS[item.checkpoint_key]}{item.review_notes ? ` — Nota: ${item.review_notes}` : ''}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {context.qcCheckpoints.map((checkpoint, index) => (
            <form key={checkpoint.id} action={qcFormAction} className="space-y-2 rounded-2xl border bg-background p-3">
              <input type="hidden" name="event_id" value={context.event.id} />
              <input type="hidden" name="checkpoint_key" value={checkpoint.checkpoint_key} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{index + 1}. {TEAM_LEADER_QC_CHECKPOINT_LABELS[checkpoint.checkpoint_key]}</p>
                <Badge variant={checkpoint.status === 'approved' ? 'success' : checkpoint.status === 'observed' ? 'warning' : checkpoint.status === 'submitted' ? 'secondary' : 'outline'}>
                  {TEAM_LEADER_QC_CHECKPOINT_STATUS_LABELS[checkpoint.status]}
                </Badge>
              </div>
              {checkpoint.latest_submission_kind === 'resubmitted' ? <p className="text-xs font-medium text-sky-700">Último envío: recaptura reenviada.</p> : null}
              {checkpoint.recorded_at ? (
                <p className="text-xs text-muted-foreground">
                  Registrado: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(checkpoint.recorded_at))}
                </p>
              ) : null}
              {checkpoint.comment ? <p className="text-xs text-muted-foreground">Último comentario: {checkpoint.comment}</p> : null}
              {checkpoint.review_notes ? <p className="text-xs text-amber-700">Nota supervisor: {checkpoint.review_notes}</p> : null}
              {checkpoint.reviewed_at ? (
                <p className="text-xs text-muted-foreground">
                  Revisado: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(checkpoint.reviewed_at))}
                </p>
              ) : null}
              <Input name="checkpoint_comment" placeholder="Comentario opcional (incidencia, contexto, nota)." defaultValue="" />
              <input
                name="checkpoint_evidence_files"
                type="file"
                accept="image/*,application/pdf"
                multiple
                required
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  {checkpoint.status === 'observed' ? 'Reenviar recaptura' : 'Registrar checkpoint'}
                </Button>
              </div>
              {checkpoint.history.length > 0 ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Historial reciente</p>
                  <ul className="mt-1 space-y-1">
                    {checkpoint.history.slice(0, 4).map((log) => (
                      <li key={log.id}>
                        {TEAM_LEADER_QC_CHECKPOINT_LOG_ACTION_LABELS[log.action_kind]} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.created_at))}
                        {log.note ? ` · ${log.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </form>
          ))}
          <AuthFeedback state={qcState} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Shopping list</CardTitle>
          <CardDescription>Material faltante por comprar para cubrir el evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredShoppingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin compras pendientes.</p>
          ) : (
            filteredShoppingList.map((row) => (
              <form key={`shopping-${row.requirement.id}`} action={executionFormAction} className="rounded-2xl border bg-background p-3">
                <input type="hidden" name="event_id" value={context.event.id} />
                <input type="hidden" name="requirement_id" value={row.requirement.id} />
                <input type="hidden" name="track" value="shopping" />
                <input type="hidden" name="next_status" value={row.executionState?.shopping_status === 'bought' ? 'pending' : 'bought'} />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.item?.name ?? 'Material'}</p>
                    <p className="text-xs text-muted-foreground">Comprar: {qty(row.quantityToBuy)} {row.item?.unit ?? 'u'}</p>
                  </div>
                  <Button type="submit" size="sm" variant={row.executionState?.shopping_status === 'bought' ? 'outline' : 'default'}>
                    {row.executionState?.shopping_status === 'bought' ? 'Reabrir' : 'Marcar comprado'}
                  </Button>
                </div>
              </form>
            ))
          )}
          <AuthFeedback state={executionState} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Pull-from-storage list</CardTitle>
          <CardDescription>Material a sacar de bodega/storage para montar barra(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPickingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin surtido pendiente.</p>
          ) : (
            filteredPickingList.map((row) => (
              <form key={`picking-${row.requirement.id}`} action={executionFormAction} className="rounded-2xl border bg-background p-3">
                <input type="hidden" name="event_id" value={context.event.id} />
                <input type="hidden" name="requirement_id" value={row.requirement.id} />
                <input type="hidden" name="track" value="picking" />
                <input type="hidden" name="next_status" value={row.executionState?.picking_status === 'pulled' ? 'pending' : 'pulled'} />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.item?.name ?? 'Material'}</p>
                    <p className="text-xs text-muted-foreground">Surtir: {qty(row.quantityToPull)} {row.item?.unit ?? 'u'}</p>
                    <p className="text-xs text-muted-foreground">Storage: {row.item?.storage_location ?? 'Sin ubicación'} · Caja: {row.item?.storage_box ?? 'Sin caja'}</p>
                  </div>
                  <Button type="submit" size="sm" variant={row.executionState?.picking_status === 'pulled' ? 'outline' : 'default'}>
                    {row.executionState?.picking_status === 'pulled' ? 'Reabrir' : 'Marcar surtido'}
                  </Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Checklist operativo</CardTitle>
          <CardDescription>Checklist clave del evento para ejecución en campo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {context.checklistItems.map((item) => (
            <form key={item.id} action={checklistFormAction}>
              <input type="hidden" name="event_id" value={context.event.id} />
              <input type="hidden" name="checklist_item_id" value={item.id} />
              <input type="hidden" name="next_completed" value={String(!item.is_completed)} />
              <button type="submit" className="flex w-full items-center justify-between rounded-2xl border bg-background px-3 py-3 text-left">
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.description ?? 'Sin detalle adicional'}</span>
                </span>
                <span>{item.is_completed ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-muted-foreground" />}</span>
              </button>
            </form>
          ))}
          <AuthFeedback state={checklistState} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Closeout post-event</CardTitle>
          <CardDescription>Captura used / leftover / returned / waste para revisión administrativa (2C).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPickingList.length === 0 && filteredShoppingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin materiales ligados para closeout en este evento.</p>
          ) : (
            filteredCloseoutRows
              .filter((row, idx, arr) => arr.findIndex((x) => x.requirement.id === row.requirement.id) === idx)
              .map((row) => (
                <form key={`closeout-${row.requirement.id}`} action={closeoutFormAction} className="grid gap-2 rounded-2xl border bg-background p-3 md:grid-cols-5">
                  <input type="hidden" name="event_id" value={context.event.id} />
                  <input type="hidden" name="requirement_id" value={row.requirement.id} />
                  <div className="md:col-span-5">
                    <p className="font-medium">{row.item?.name ?? 'Material'}</p>
                    <p className="text-xs text-muted-foreground">Requerido: {qty(row.requirement.quantity_required)} {row.item?.unit ?? 'u'}</p>
                  </div>
                  <Input name="quantity_used" type="number" step="0.01" min="0" defaultValue={String(row.requirement.quantity_used ?? 0)} placeholder="Used" />
                  <Input name="leftover_quantity" type="number" step="0.01" min="0" defaultValue={String(row.closeoutState?.leftover_quantity ?? 0)} placeholder="Leftover" />
                  <Input name="returned_quantity" type="number" step="0.01" min="0" defaultValue={String(row.closeoutState?.returned_quantity ?? 0)} placeholder="Returned" />
                  <Input name="waste_quantity" type="number" step="0.01" min="0" defaultValue={String(row.closeoutState?.waste_quantity ?? 0)} placeholder="Waste" />
                  <Button type="submit" className="md:col-span-1"><Truck className="size-4" />Enviar</Button>
                  <Input name="closeout_note" className="md:col-span-5" placeholder="Nota de cierre opcional" defaultValue={row.closeoutState?.note ?? ''} />
                </form>
              ))
          )}
          <AuthFeedback state={closeoutState} />
        </CardContent>
      </Card>
    </section>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-3 p-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-base font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
