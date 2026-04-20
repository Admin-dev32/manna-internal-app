'use client';

import { useActionState } from 'react';
import type { ComponentType } from 'react';
import { BadgeCheck, CheckCircle2, ClipboardList, Package, ShoppingCart, UserRound } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialEmployeeActionFormState } from '@/services/employees/form-state';
import type { EmployeeActionFormState } from '@/services/employees/form-state';
import type { AssistantLightContext } from '@/types/employees';

function formatDateTime(date: string, time: string) {
  const formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date(`${date}T00:00:00.000Z`));
  return `${formattedDate} · ${String(time).slice(0, 5)}`;
}

function qty(value: number | null | undefined) {
  if (value == null) return '0';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value));
}

export function AssistantLightPanel({
  context,
  completeChecklistAction,
}: {
  context: AssistantLightContext;
  completeChecklistAction: (state: EmployeeActionFormState, formData: FormData) => Promise<EmployeeActionFormState>;
}) {
  const [checklistState, checklistFormAction] = useActionState(completeChecklistAction, initialEmployeeActionFormState);
  const pendingChecklist = context.checklistItems.filter((item) => !item.is_completed);

  return (
    <section className="space-y-4">
      <Card className="rounded-3xl border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-xl">Assistant · Light Mode</CardTitle>
          <CardDescription>
            Vista ligera para apoyo operativo. No reemplaza la responsabilidad principal del Team Leader.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="font-semibold text-foreground">{context.event.event_type ?? 'Evento'} #{context.event.id.slice(0, 8)}</p>
          <p className="text-muted-foreground">{formatDateTime(context.event.event_date, context.event.event_time)}</p>
          <p className="text-muted-foreground">{context.event.location ?? 'Dirección pendiente'}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Estado evento: {context.eventStatusLabel}</Badge>
            <Badge variant="outline">Servicio: {context.event.booked_service}</Badge>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserRound className="size-4" /> Team Leader responsable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{context.teamLeaderName ?? 'Sin Team Leader responsable confirmado todavía'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Handoff: {context.handoffStatus === 'handed_off' ? 'realizado' : context.handoffStatus === 'ready_for_handoff' ? 'listo' : 'draft'}.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat icon={ClipboardList} label="Checklist pendiente" value={`${pendingChecklist.length}`} />
        <MiniStat icon={ShoppingCart} label="Compras por cubrir" value={`${context.shoppingList.length}`} />
        <MiniStat icon={Package} label="Surtidos por cubrir" value={`${context.pickingList.length}`} />
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Checklist de apoyo</CardTitle>
          <CardDescription>
            Puedes marcar avances concretos de apoyo. No puedes reabrir ítems ni controlar todo el flujo operativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingChecklist.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">No hay checklist pendiente para tu apoyo.</p>
          ) : (
            pendingChecklist.map((item) => (
              <form key={item.id} action={checklistFormAction} className="rounded-2xl border bg-background p-3">
                <input type="hidden" name="event_id" value={context.event.id} />
                <input type="hidden" name="checklist_item_id" value={item.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description ?? 'Sin detalle adicional'}</p>
                  </div>
                  <Button type="submit" size="sm"><CheckCircle2 className="size-4" />Completar</Button>
                </div>
              </form>
            ))
          )}
          <AuthFeedback state={checklistState} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Inventario relevante (solo lectura)</CardTitle>
          <CardDescription>
            Referencia de apoyo para que sepas qué falta por comprar/surtir. El control principal sigue en Team Leader.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Shopping</p>
            {context.shoppingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin compras pendientes.</p>
            ) : (
              context.shoppingList.slice(0, 8).map((row) => (
                <div key={`assistant-shopping-${row.requirement.id}`} className="rounded-2xl border bg-background px-3 py-2 text-sm">
                  <p className="font-medium">{row.item?.name ?? 'Material'}</p>
                  <p className="text-xs text-muted-foreground">
                    Faltante: {qty(row.quantityToBuy)} {row.item?.unit ?? 'u'} · Estado: {row.executionState?.shopping_status === 'bought' ? 'Comprado' : 'Pendiente'}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Pull-from-storage</p>
            {context.pickingList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin surtido pendiente.</p>
            ) : (
              context.pickingList.slice(0, 8).map((row) => (
                <div key={`assistant-picking-${row.requirement.id}`} className="rounded-2xl border bg-background px-3 py-2 text-sm">
                  <p className="font-medium">{row.item?.name ?? 'Material'}</p>
                  <p className="text-xs text-muted-foreground">
                    Surtir: {qty(row.quantityToPull)} {row.item?.unit ?? 'u'} · Storage: {row.item?.storage_location ?? 'Sin ubicación'} · Caja: {row.item?.storage_box ?? 'Sin caja'}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
            Límite intencional de Assistant Light Mode: sin control de shopping/picking/closeout, sin privilegios administrativos.
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <BadgeCheck className="mt-0.5 size-4 text-emerald-600" />
          Tu acceso aquí depende de tu asignación aceptada como Assistant en este evento.
          Los permission overrides globales del Owner no se sustituyen por este modo operativo.
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
