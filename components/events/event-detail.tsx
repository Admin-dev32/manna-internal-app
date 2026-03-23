import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Circle, Clock3, FileText, MapPin, Trash2, UserRoundCog, Users } from 'lucide-react';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { EventTasksSection } from '@/components/tasks/event-tasks-section';
import { EventInventorySection } from '@/components/inventory/event-inventory-section';
import { FinancialSummaryCard } from '@/components/finance/financial-summary-card';
import { EventTemplateSection } from '@/components/templates/event-template-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  EVENT_ASSIGNMENT_ROLE_LABELS,
  EVENT_ASSIGNMENT_STATUS_LABELS,
  EVENT_STATUS_DESCRIPTIONS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TRANSITIONS,
} from '@/config/events';
import {
  createEventStaffAssignmentAction,
  removeEventStaffAssignmentAction,
  updateEventOperationalNotesAction,
  updateEventStaffAssignmentAction,
  updateEventStatusAction,
  toggleEventChecklistItemAction,
} from '@/services/events/actions';
import type { ClientRecord } from '@/types/clients';
import type { EventChecklistItemRecord, EventChecklistProgress, EventFinanceSnapshot, EventRecord, EventStaffAssignmentRecord, EventTaskRecord } from '@/types/events';
import type { EventInventoryRequirementRecord, InventoryAvailabilitySummary, InventoryItemRecord } from '@/types/inventory';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type { EventOperationalTemplateApplicationRecord } from '@/types/operational-templates';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function EventDetail({
  event,
  client,
  lead,
  preEvent,
  quote,
  checklistItems,
  checklistProgress,
  assignments,
  tasks,
  inventoryItems,
  inventoryRequirements,
  inventoryAvailabilityByItem,
  applicableOperationalTemplates,
  operationalTemplateApplications,
  operationalTemplateProfiles,
  assignableProfiles,
  profiles,
  financeSummary,
  canViewFinance,
}: {
  event: EventRecord;
  client: ClientRecord;
  lead: LeadRecord | null;
  preEvent: PreEventRecord;
  quote: QuoteRecord;
  checklistItems: EventChecklistItemRecord[];
  checklistProgress: EventChecklistProgress;
  assignments: EventStaffAssignmentRecord[];
  tasks: EventTaskRecord[];
  inventoryItems: InventoryItemRecord[];
  inventoryRequirements: EventInventoryRequirementRecord[];
  inventoryAvailabilityByItem: Record<string, InventoryAvailabilitySummary>;
  applicableOperationalTemplates: Array<{
    template: {
      id: string;
      name: string;
      event_type: string | null;
      note: string | null;
    };
    checklistItems: Array<{ id: string }>;
    taskItems: Array<{ id: string }>;
    materialItems: Array<{ id: string }>;
  }>;
  operationalTemplateApplications: EventOperationalTemplateApplicationRecord[];
  operationalTemplateProfiles: Record<string, LeadProfileOption>;
  assignableProfiles: LeadProfileOption[];
  profiles: Record<string, LeadProfileOption>;
  financeSummary: EventFinanceSnapshot | null;
  canViewFinance: boolean;
}) {
  const allowedTransitions = EVENT_STATUS_TRANSITIONS[event.status];
  const confirmedAssignments = assignments.filter((assignment) => assignment.assignment_status === 'confirmado').length;
  const pendingAssignments = assignments.length - confirmedAssignments;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <EventStatusBadge status={event.status} />
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Cliente: {client.full_name}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Servicio: {event.booked_service}</span>
        </div>
        <div className="mt-4">
          <h1 className="text-3xl font-semibold">{event.event_type ?? 'Evento operativo'}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Herramienta operativa real para coordinar preparación, seguimiento y cierre del evento sin tocar el contexto comercial original.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={'/eventos' as Route}>Ver agenda operativa</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/reservas/${preEvent.id}` as Route}>Volver a reserva</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/cotizaciones/${quote.id}` as Route}>Ver cotización origen</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalle operativo</CardTitle>
              <CardDescription>Información principal para ejecutar el evento en operación diaria.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem icon={Users} label="Cliente" value={client.full_name} />
              <InfoItem icon={CalendarClock} label="Fecha y hora" value={`${formatDate(event.event_date)} · ${event.event_time}`} />
              <InfoItem icon={MapPin} label="Dirección" value={event.location ?? 'Pendiente de definir'} />
              <InfoItem icon={FileText} label="Tipo de evento" value={event.event_type ?? 'Pendiente'} />
              <InfoItem icon={FileText} label="Servicio contratado" value={event.booked_service} />
              <InfoItem icon={Users} label="Invitados" value={event.guest_count?.toString() ?? 'Pendiente'} />
              <InfoItem icon={Clock3} label="Estado del evento" value={EVENT_STATUS_LABELS[event.status]} />
              <InfoItem icon={FileText} label="Origen" value={`Lead ${lead ? `#${lead.id.slice(0, 8)}` : 'sin lead'} · Quote #${quote.id.slice(0, 8)} · Reserva #${preEvent.id.slice(0, 8)}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist operativa</CardTitle>
              <CardDescription>Base mínima para preparación real del evento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{checklistProgress.completed}/{checklistProgress.total} completos</Badge>
                <Badge variant={checklistProgress.pending > 0 ? 'warning' : 'success'}>
                  {checklistProgress.pending > 0 ? `${checklistProgress.pending} pendientes` : 'Checklist completa'}
                </Badge>
              </div>
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <form key={item.id} action={toggleEventChecklistItemAction.bind(null, event.id, item.id, !item.is_completed)}>
                    <button
                      type="submit"
                      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <span className="mt-0.5 text-primary">
                        {item.is_completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{item.description ?? 'Sin descripción adicional.'}</span>
                      </span>
                      <Badge variant={item.is_completed ? 'success' : 'outline'}>{item.is_completed ? 'Completo' : 'Pendiente'}</Badge>
                    </button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asignación básica de personal</CardTitle>
              <CardDescription>Responsables internos mínimos para operar el evento con claridad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <InfoItem icon={UserRoundCog} label="Asignaciones" value={assignments.length.toString()} />
                <InfoItem icon={CheckCircle2} label="Confirmadas" value={confirmedAssignments.toString()} />
                <InfoItem icon={Clock3} label="Pendientes" value={pendingAssignments.toString()} />
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  Aún no hay personal asignado a este evento.
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => {
                    const assignedProfile = profiles[assignment.profile_id];
                    const createdByProfile = profiles[assignment.created_by];
                    const updatedByProfile = profiles[assignment.updated_by];

                    return (
                      <div key={assignment.id} className="rounded-3xl border border-border bg-background p-4">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{assignedProfile?.full_name ?? 'Usuario interno'}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge>{EVENT_ASSIGNMENT_ROLE_LABELS[assignment.assignment_role]}</Badge>
                              <Badge variant={assignment.assignment_status === 'confirmado' ? 'success' : 'warning'}>
                                {EVENT_ASSIGNMENT_STATUS_LABELS[assignment.assignment_status]}
                              </Badge>
                              {assignedProfile?.role ? <Badge variant="outline">Perfil: {assignedProfile.role}</Badge> : null}
                            </div>
                          </div>
                          <form action={removeEventStaffAssignmentAction.bind(null, event.id, assignment.id)}>
                            <Button type="submit" variant="outline">
                              <Trash2 className="size-4" />
                              Quitar
                            </Button>
                          </form>
                        </div>

                        <form action={updateEventStaffAssignmentAction.bind(null, event.id, assignment.id)} className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rol</label>
                            <select
                              name="assignment_role"
                              defaultValue={assignment.assignment_role}
                              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              {Object.entries(EVENT_ASSIGNMENT_ROLE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                            <select
                              name="assignment_status"
                              defaultValue={assignment.assignment_status}
                              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              {Object.entries(EVENT_ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
                            <Input name="note" defaultValue={assignment.note ?? ''} placeholder="Contexto breve de la asignación" />
                          </div>

                          <div className="flex items-end">
                            <Button type="submit" className="w-full">
                              Guardar
                            </Button>
                          </div>
                        </form>

                        <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground md:grid-cols-2">
                          <span>Asignado por: <strong className="text-foreground">{createdByProfile?.full_name ?? 'Usuario interno'}</strong></span>
                          <span>Última actualización: <strong className="text-foreground">{updatedByProfile?.full_name ?? 'Usuario interno'}</strong></span>
                          <span>Creado: <strong className="text-foreground">{formatDateTime(assignment.created_at)}</strong></span>
                          <span>Editado: <strong className="text-foreground">{formatDateTime(assignment.updated_at)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-3xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Agregar responsable</h3>
                <p className="mt-1 text-sm text-muted-foreground">Solo se muestran perfiles internos activos que todavía no están asignados a este evento.</p>
                {assignableProfiles.length > 0 ? (
                  <form action={createEventStaffAssignmentAction.bind(null, event.id)} className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Persona interna</label>
                      <select
                        name="profile_id"
                        defaultValue=""
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="" disabled>
                          Selecciona un usuario
                        </option>
                        {assignableProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {(profile.full_name ?? profile.id) + (profile.role ? ` · ${profile.role}` : '')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rol</label>
                      <select
                        name="assignment_role"
                        defaultValue="general"
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {Object.entries(EVENT_ASSIGNMENT_ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                      <select
                        name="assignment_status"
                        defaultValue="pendiente"
                        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {Object.entries(EVENT_ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nota</label>
                      <Input name="note" placeholder="Ej. llega antes para supervisar montaje" />
                    </div>

                    <div className="flex items-end">
                      <Button type="submit" className="w-full">
                        Asignar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    No hay más perfiles internos disponibles para asignar en este evento.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


          <EventTasksSection eventId={event.id} tasks={tasks} assignments={assignments} profiles={profiles} />

          <EventTemplateSection
            eventId={event.id}
            preEventId={preEvent.id}
            templates={applicableOperationalTemplates}
            applications={operationalTemplateApplications}
            profiles={operationalTemplateProfiles}
          />

          <EventInventorySection
            eventId={event.id}
            inventoryItems={inventoryItems}
            requirements={inventoryRequirements}
            availabilityByItem={inventoryAvailabilityByItem}
          />

          <Card>
            <CardHeader>
              <CardTitle>Notas internas operativas</CardTitle>
              <CardDescription>Separadas del contexto comercial original para coordinación del evento.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateEventOperationalNotesAction.bind(null, event.id)} className="space-y-4">
                <Textarea
                  name="operational_notes"
                  rows={8}
                  defaultValue={event.operational_notes ?? ''}
                  placeholder="Ejemplo: acceso de carga, contacto onsite, restricciones del venue, setup especial..."
                />
                <div className="flex justify-end">
                  <Button type="submit">Guardar notas operativas</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estados del evento</CardTitle>
              <CardDescription>{EVENT_STATUS_DESCRIPTIONS[event.status]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado actual</p>
                <div className="mt-3 flex items-center gap-2">
                  <EventStatusBadge status={event.status} />
                  <span className="text-sm text-muted-foreground">Transiciones disponibles según el estado actual.</span>
                </div>
              </div>
              {allowedTransitions.length > 0 ? (
                <div className="grid gap-3">
                  {allowedTransitions.map((nextStatus) => (
                    <form key={nextStatus} action={updateEventStatusAction.bind(null, event.id, nextStatus)}>
                      <Button type="submit" variant="outline" className="w-full justify-between">
                        Mover a {EVENT_STATUS_LABELS[nextStatus]}
                        <span className="text-xs text-muted-foreground">{EVENT_STATUS_DESCRIPTIONS[nextStatus]}</span>
                      </Button>
                    </form>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  Este evento ya está en un estado final y no tiene transiciones configuradas en esta iteración.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Origen del flujo</CardTitle>
              <CardDescription>Trazabilidad desde venta hasta operación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Lead origen" value={lead ? `${lead.full_name} · #${lead.id.slice(0, 8)}` : 'Sin lead ligado'} />
              <SummaryRow label="Cotización origen" value={`#${quote.id.slice(0, 8)} · ${quote.status}`} />
              <SummaryRow label="Reserva origen" value={`#${preEvent.id.slice(0, 8)} · ${preEvent.status}`} />
              <SummaryRow label="Cliente" value={client.full_name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trazabilidad</CardTitle>
              <CardDescription>Registro interno del evento operativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Creado por" value={profiles[event.created_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Última edición" value={profiles[event.updated_by]?.full_name ?? 'Usuario interno'} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canViewFinance && financeSummary ? (
        <FinancialSummaryCard
          summary={financeSummary}
          title="Resumen financiero read-only"
          description="Se reutiliza la hoja financiera existente de la cotización origen cuando el usuario tiene permiso financiero."
        />
      ) : null}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-background px-4 py-3">
      <span>{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
