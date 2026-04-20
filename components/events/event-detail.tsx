import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Circle, Clock3, FileText, MapPin, Trash2, UserRoundCog, Users } from 'lucide-react';

import { EventStatusBadge } from '@/components/events/event-status-badge';
import { EventTasksSection } from '@/components/tasks/event-tasks-section';
import { RecurringTaskRulesSection } from '@/components/tasks/recurring-task-rules-section';
import { EventInventorySection } from '@/components/inventory/event-inventory-section';
import { EventExpensesCard } from '@/components/finance/event-expenses-card';
import { FinancialSummaryCard } from '@/components/finance/financial-summary-card';
import { EventTemplateSection } from '@/components/templates/event-template-section';
import { EventCalendarSyncCard } from '@/components/events/event-calendar-sync-card';
import { RecordTimelineSection } from '@/components/communication/record-timeline-section';
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
  updateEventOperationalHandoffStateAction,
  syncEventToGoogleCalendarAction,
  updateEventOperationalNotesAction,
  updateEventStaffAssignmentAction,
  updateEventStatusAction,
  toggleEventChecklistItemAction,
} from '@/services/events/actions';
import { validateEventCalendarRequirements } from '@/services/events/calendar';
import { buildBarOperationalControls, buildMultiBarOperationalHandoffSummary } from '@/lib/bar-service-operational-controls';
import type { EventCalendarSyncRecord } from '@/types/calendar';
import type { ClientRecord } from '@/types/clients';
import type { EmployeeEventReportRecord, EmployeeReportEvidenceRecord } from '@/types/employees';
import type {
  EventChecklistItemRecord,
  EventChecklistProgress,
  EventFinanceSnapshot,
  EventOperationalHandoffStateRecord,
  EventRecord,
  EventStaffAssignmentRecord,
  EventTaskRecord,
} from '@/types/events';
import type { RecurringTaskRuleRecord } from '@/types/recurring-tasks';
import type { FinancialExpenseRecord } from '@/types/finance';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateRecord,
  EventInventoryCloseoutStateRecord,
  EventInventoryExecutionStateRecord,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
  InventoryItemRecord,
  InventoryStockMovementView,
} from '@/types/inventory';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type {
  EventOperationalTemplateApplicationRecord,
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';
import type { EventOperationalHubStatus, EventOperationalSignal } from '@/services/events/queries';

const HUB_STATUS_LABELS: Record<EventOperationalHubStatus, string> = {
  pendiente: 'Pendiente',
  listo_para_operar: 'Listo para operar',
  en_preparacion: 'En preparación',
  en_servicio: 'En servicio',
  cerrado: 'Cerrado',
  con_incidencias: 'Con incidencias',
};

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
  recurringTaskRules,
  canViewTasks,
  canManageTasks,
  canAssignTasks,
  canUpdateTaskStatus,
  canViewChat,
  canViewInventory,
  canPrepareInventory,
  canApproveInventoryCloseout,
  inventoryItems,
  inventoryRequirements,
  inventoryExecutionStateByRequirement,
  inventoryCloseoutStateByRequirement,
  inventoryAvailabilityByItem,
  inventoryRecentMovements,
  barMasterTemplates,
  barMasterTemplateApplications,
  applicableOperationalTemplates,
  operationalTemplateApplications,
  operationalTemplateProfiles,
  assignableProfiles,
  profiles,
  financeSummary,
  canViewFinance,
  canViewExpenses,
  eventExpenses,
  calendarSync,
  handoffState,
  operationalHubStatus,
  operationalSignals,
  employeeReports,
  reportEvidencesByReport,
  availabilityRows,
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
  recurringTaskRules: RecurringTaskRuleRecord[];
  canViewTasks: boolean;
  canManageTasks: boolean;
  canAssignTasks: boolean;
  canUpdateTaskStatus: boolean;
  canViewChat: boolean;
  canViewInventory: boolean;
  canPrepareInventory: boolean;
  canApproveInventoryCloseout: boolean;
  inventoryItems: InventoryItemRecord[];
  inventoryRequirements: EventInventoryRequirementRecord[];
  inventoryExecutionStateByRequirement: Record<string, EventInventoryExecutionStateRecord>;
  inventoryCloseoutStateByRequirement: Record<string, EventInventoryCloseoutStateRecord>;
  inventoryAvailabilityByItem: Record<string, InventoryAvailabilitySummary>;
  inventoryRecentMovements: InventoryStockMovementView[];
  barMasterTemplates: BarMasterTemplateRecord[];
  barMasterTemplateApplications: BarMasterTemplateApplicationRecord[];
  applicableOperationalTemplates: Array<{
    template: {
      id: string;
      name: string;
      slug: string;
      service_category: string | null;
      event_type: string | null;
      note: string | null;
    };
    checklistItems: OperationalTemplateChecklistItemRecord[];
    taskItems: OperationalTemplateTaskItemRecord[];
    materialItems: OperationalTemplateMaterialItemRecord[];
  }>;
  operationalTemplateApplications: EventOperationalTemplateApplicationRecord[];
  operationalTemplateProfiles: Record<string, LeadProfileOption>;
  assignableProfiles: LeadProfileOption[];
  profiles: Record<string, LeadProfileOption>;
  financeSummary: EventFinanceSnapshot | null;
  canViewFinance: boolean;
  canViewExpenses: boolean;
  eventExpenses: FinancialExpenseRecord[];
  calendarSync: EventCalendarSyncRecord | null;
  handoffState: EventOperationalHandoffStateRecord | null;
  operationalHubStatus: EventOperationalHubStatus;
  operationalSignals: EventOperationalSignal[];
  employeeReports: EmployeeEventReportRecord[];
  reportEvidencesByReport: Record<string, Array<EmployeeReportEvidenceRecord & { signed_url: string | null }>>;
  availabilityRows: Array<{ profile_id: string; reason: string; created_at: string; availability_status: string }>;
}) {
  const allowedTransitions = EVENT_STATUS_TRANSITIONS[event.status];
  const confirmedAssignments = assignments.filter((assignment) => assignment.assignment_status === 'confirmado' || assignment.assignment_status === 'accepted').length;
  const pendingAssignments = assignments.length - confirmedAssignments;
  const supervisorResponsible = assignments.find((assignment) => assignment.is_supervisor_responsible);
  const teamLeaderResponsible = assignments.find((assignment) => assignment.is_team_leader_responsible);
  const assistantAssignments = assignments.filter((assignment) => assignment.assignment_role === 'assistant');
  const pendingReviewReports = employeeReports.filter((report) => report.review_status === 'pendiente_revision' || report.review_status === 'requiere_correccion').length;
  const bonusReleasedReports = employeeReports.filter((report) => report.review_status === 'bonus_liberado').length;
  const calendarRequirements = validateEventCalendarRequirements(event, client);
  const calendarAction = syncEventToGoogleCalendarAction.bind(null, event.id);
  const handoffBars = barMasterTemplateApplications.map((application) => {
    const template = barMasterTemplates.find((item) => item.id === application.template_id) ?? null;
    const controls = buildBarOperationalControls({
      selectedTemplate: template,
      latestApplication: application,
      requirements: inventoryRequirements,
      availabilityByItem: inventoryAvailabilityByItem,
      executionStateByRequirement: inventoryExecutionStateByRequirement,
      checklistProgress,
    });
    const summary = application.result_summary ?? {};

    return {
      templateName: String(summary.applied_template_name ?? '').trim() || template?.name || 'Barra sin nombre',
      approvalStatus: application.approval_status,
      readinessLabel: controls?.readinessLabel ?? 'Incompleta',
      checks: controls?.checks ?? [],
      summary: {
        skippedCount: Number(summary.skipped_without_inventory_link ?? 0),
        scaledItemsCount: Number(summary.scaled_items_count ?? 0),
        insertedCount: Number(summary.inserted_count ?? 0),
        updatedCount: Number(summary.updated_count ?? 0),
      },
    };
  });
  const handoffSnapshot = buildMultiBarOperationalHandoffSummary({ bars: handoffBars });

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
          <EventCalendarSyncCard sync={calendarSync} requirements={calendarRequirements} action={calendarAction} />

          <Card>
            <CardHeader>
              <CardTitle>Hub operativo final del evento</CardTitle>
              <CardDescription>Consolidación práctica de ejecución real: calendar, staff, reportes y señales de riesgo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={operationalHubStatus === 'con_incidencias' ? 'warning' : operationalHubStatus === 'cerrado' ? 'outline' : 'success'}>
                  {HUB_STATUS_LABELS[operationalHubStatus]}
                </Badge>
                <Badge variant="outline">Estado base: {EVENT_STATUS_LABELS[event.status]}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <InfoItem icon={Users} label="Staff confirmado" value={`${confirmedAssignments}/${assignments.length}`} />
                <InfoItem icon={FileText} label="Reportes" value={employeeReports.length.toString()} />
                <InfoItem icon={Clock3} label="Pendientes revisión" value={pendingReviewReports.toString()} />
                <InfoItem icon={CheckCircle2} label="Bonus liberado" value={bonusReleasedReports.toString()} />
              </div>
              <div className="space-y-2">
                {operationalSignals.map((signal) => (
                  <div key={signal.key} className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm">
                    <span className="font-semibold">{signal.level.toUpperCase()}:</span> {signal.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
              <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Los roles operativos de evento (Supervisor, Team Leader, Assistant) no reemplazan permisos base del usuario.
                Owner mantiene control fino mediante permission overrides en gestión de usuarios.
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
                              <Badge variant={assignment.assignment_status === 'confirmado' || assignment.assignment_status === 'accepted' ? 'success' : assignment.assignment_status === 'rejected' ? 'outline' : 'warning'}>
                                {EVENT_ASSIGNMENT_STATUS_LABELS[assignment.assignment_status]}
                              </Badge>
                              {assignment.is_supervisor_responsible ? <Badge variant="secondary">Supervisor responsable</Badge> : null}
                              {assignment.is_team_leader_responsible ? <Badge variant="secondary">Team Leader principal</Badge> : null}
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

                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" name="is_supervisor_responsible" defaultChecked={assignment.is_supervisor_responsible} />
                            Supervisor responsable
                          </label>

                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" name="is_team_leader_responsible" defaultChecked={assignment.is_team_leader_responsible} />
                            Team Leader principal
                          </label>

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
                          {assignment.responded_at ? (
                            <span className="md:col-span-2">
                              Respuesta colaborador: <strong className="text-foreground">{EVENT_ASSIGNMENT_STATUS_LABELS[assignment.assignment_status]}</strong>
                              {' · '}
                              {formatDateTime(assignment.responded_at)}
                              {assignment.response_note ? ` · ${assignment.response_note}` : ''}
                            </span>
                          ) : null}
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

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" name="is_supervisor_responsible" />
                      Supervisor responsable
                    </label>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" name="is_team_leader_responsible" />
                      Team Leader principal
                    </label>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado</label>
                      <select
                        name="assignment_status"
                        defaultValue="pending_acceptance"
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

              <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                <p className="font-semibold text-foreground">Responsables operativos del evento</p>
                <p className="mt-2 text-muted-foreground">Supervisor: {supervisorResponsible ? (profiles[supervisorResponsible.profile_id]?.full_name ?? 'Usuario interno') : 'Sin definir'}</p>
                <p className="text-muted-foreground">Team Leader principal: {teamLeaderResponsible ? (profiles[teamLeaderResponsible.profile_id]?.full_name ?? 'Usuario interno') : 'Sin definir'}</p>
                <p className="text-muted-foreground">Assistants: {assistantAssignments.length > 0 ? assistantAssignments.map((item) => profiles[item.profile_id]?.full_name ?? 'Usuario interno').join(', ') : 'Sin assistants asignados'}</p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="font-semibold text-foreground">Handoff supervisor → team leader</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estado actual: {' '}
                  <strong className="text-foreground">
                    {handoffState?.handoff_status === 'ready_for_handoff'
                      ? 'Listo para handoff'
                      : handoffState?.handoff_status === 'handed_off'
                        ? 'Handoff realizado'
                        : 'Draft'}
                  </strong>
                </p>
                {handoffSnapshot.aggregate.total > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estado barras aplicadas:{' '}
                    <strong className="text-foreground">
                      {handoffSnapshot.aggregate.approved}/{handoffSnapshot.aggregate.total} aprobadas · {handoffSnapshot.aggregate.ready} listas · {handoffSnapshot.aggregate.risk} en riesgo · {handoffSnapshot.aggregate.incomplete} incompletas
                    </strong>
                  </p>
                ) : null}
                <form action={updateEventOperationalHandoffStateAction.bind(null, event.id)} className="mt-3 grid gap-3 md:grid-cols-3">
                  <select name="handoff_status" defaultValue={handoffState?.handoff_status ?? 'draft'} className="rounded-2xl border border-input bg-background px-4 py-2 text-sm">
                    <option value="draft">Draft</option>
                    <option value="ready_for_handoff">Listo para handoff</option>
                    <option value="handed_off">Handoff realizado</option>
                  </select>
                  <select name="target_team_leader_assignment_id" defaultValue={handoffState?.target_team_leader_assignment_id ?? 'none'} className="rounded-2xl border border-input bg-background px-4 py-2 text-sm">
                    <option value="none">Sin team leader objetivo</option>
                    {assignments
                      .filter((item) => item.assignment_role === 'team_leader' || item.is_team_leader_responsible)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {profiles[item.profile_id]?.full_name ?? item.profile_id}
                        </option>
                      ))}
                  </select>
                  <Input name="ready_note" defaultValue={handoffState?.ready_note ?? ''} placeholder="Nota de handoff (opcional)" />
                  <div className="md:col-span-3 rounded-2xl border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Snapshot sugerido por barra aplicada</p>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{handoffSnapshot.text}</pre>
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <Button type="submit">Guardar handoff</Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ejecución de staff: reportes y evidencias</CardTitle>
              <CardDescription>Lo que ya reportó el equipo en campo para este evento, con visibilidad operativa centralizada.</CardDescription>
              <div>
                <Button asChild variant="outline" size="sm">
                  <Link href={'/empleados/revision' as Route}>Ir a revisión gerencial</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {availabilityRows.length > 0 ? (
                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <p className="font-semibold text-amber-900">Avisos de inasistencia</p>
                  {availabilityRows.map((item, index) => (
                    <p key={`${item.profile_id}-${index}`} className="text-amber-800">
                      {profiles[item.profile_id]?.full_name ?? 'Empleado'}: {item.reason}
                    </p>
                  ))}
                </div>
              ) : null}

              {employeeReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                  Aún no hay reportes del staff para este evento.
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeReports.slice(0, 12).map((report) => (
                    <div key={report.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{report.report_stage.replaceAll('_', ' ')}</Badge>
                        <Badge variant={report.review_status === 'bonus_liberado' ? 'success' : report.review_status === 'requiere_correccion' ? 'warning' : 'outline'}>
                          {report.review_status.replaceAll('_', ' ')}
                        </Badge>
                        {report.bonus_amount ? <Badge variant="success">Bonus: ${report.bonus_amount.toFixed(2)}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{report.status_update ?? report.service_notes ?? 'Sin detalle textual.'}</p>
                      {(reportEvidencesByReport[report.id]?.length ?? 0) > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {reportEvidencesByReport[report.id].map((evidence) => (
                            <a
                              key={evidence.id}
                              href={evidence.signed_url ?? '#'}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="rounded-xl border px-3 py-2 text-xs text-primary hover:bg-primary/5"
                            >
                              Evidencia: {evidence.file_name} {evidence.is_discarded ? '(descartada)' : ''}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Sin evidencias adjuntas.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


          {canViewTasks ? (
            <RecurringTaskRulesSection
              eventId={event.id}
              rules={recurringTaskRules}
              profiles={profiles}
              canManageTasks={canManageTasks}
            />
          ) : null}

          {canViewTasks ? (
            <EventTasksSection
              eventId={event.id}
              tasks={tasks}
              assignments={assignments}
              profiles={profiles}
              canManageTasks={canManageTasks}
              canAssignTasks={canAssignTasks}
              canUpdateTaskStatus={canUpdateTaskStatus}
            />
          ) : null}

          {canViewChat ? (
            <Card>
              <CardHeader>
                <CardTitle>Chat del evento</CardTitle>
                <CardDescription>Canal de coordinación del equipo para este evento, separado del timeline contextual.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/chat?scope=event&eventId=${event.id}` as Route}>Abrir chat de evento</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <EventTemplateSection
            eventId={event.id}
            preEventId={preEvent.id}
            templates={applicableOperationalTemplates}
            applications={operationalTemplateApplications}
            profiles={operationalTemplateProfiles}
          />

          <RecordTimelineSection entityType="event" entityId={event.id} returnPath={`/eventos/${event.id}`} />

          {canViewInventory ? (
            <EventInventorySection
              eventId={event.id}
              eventSummary={{
                eventType: event.event_type,
                eventDate: event.event_date,
                eventTime: event.event_time,
                location: event.location,
              }}
              inventoryItems={inventoryItems}
              requirements={inventoryRequirements}
              executionStateByRequirement={inventoryExecutionStateByRequirement}
              closeoutStateByRequirement={inventoryCloseoutStateByRequirement}
              availabilityByItem={inventoryAvailabilityByItem}
              recentMovements={inventoryRecentMovements}
              profiles={profiles}
              canPrepareInventory={canPrepareInventory}
              canApproveCloseout={canApproveInventoryCloseout}
              barMasterTemplates={barMasterTemplates}
              barMasterApplications={barMasterTemplateApplications}
              checklistProgress={checklistProgress}
            />
          ) : null}

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
              <CardDescription>{EVENT_STATUS_DESCRIPTIONS[event.status]} · Estado operativo derivado: {HUB_STATUS_LABELS[operationalHubStatus]}.</CardDescription>
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

      {canViewExpenses ? <EventExpensesCard expenses={eventExpenses} /> : null}
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
