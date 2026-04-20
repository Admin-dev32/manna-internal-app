'use client';

import { useActionState } from 'react';
import type { ComponentType } from 'react';
import { CheckCircle2, Circle, ClipboardList, Package, ShoppingCart, Truck } from 'lucide-react';

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
}: {
  context: TeamLeaderExecutionContext;
  updateExecutionAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  toggleChecklistAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
  submitCloseoutAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [executionState, executionFormAction] = useActionState(updateExecutionAction, initialEmployeeActionFormState);
  const [checklistState, checklistFormAction] = useActionState(toggleChecklistAction, initialEmployeeActionFormState);
  const [closeoutState, closeoutFormAction] = useActionState(submitCloseoutAction, initialEmployeeActionFormState);

  const checklistDone = context.checklistItems.filter((item) => item.is_completed).length;

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
            <Badge variant={context.handoffStatus === 'handed_off' ? 'success' : context.handoffStatus === 'ready_for_handoff' ? 'secondary' : 'outline'}>
              Handoff: {context.handoffStatus === 'handed_off' ? 'Realizado' : context.handoffStatus === 'ready_for_handoff' ? 'Listo' : 'Draft'}
            </Badge>
          </div>
          {context.handoffNote ? <p className="text-xs text-muted-foreground">Nota handoff: {context.handoffNote}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat icon={ShoppingCart} label="Compras" value={`${context.shoppingList.filter((r) => r.executionState?.shopping_status === 'bought').length}/${context.shoppingList.length}`} />
        <MiniStat icon={Package} label="Surtido" value={`${context.pickingList.filter((r) => r.executionState?.picking_status === 'pulled').length}/${context.pickingList.length}`} />
        <MiniStat icon={ClipboardList} label="Checklist" value={`${checklistDone}/${context.checklistItems.length}`} />
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Shopping list</CardTitle>
          <CardDescription>Material faltante por comprar para cubrir el evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {context.shoppingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin compras pendientes.</p>
          ) : (
            context.shoppingList.map((row) => (
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
          {context.pickingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin surtido pendiente.</p>
          ) : (
            context.pickingList.map((row) => (
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
          {context.pickingList.length === 0 && context.shoppingList.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">Sin materiales ligados para closeout en este evento.</p>
          ) : (
            [...context.shoppingList, ...context.pickingList]
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
