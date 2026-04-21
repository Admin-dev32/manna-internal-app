import { notFound } from 'next/navigation';

import { EMPLOYEE_ROLE_PROJECTION_MXN, TEAM_LEADER_QC_CHECKPOINT_SEQUENCE } from '@/config/employees';
import { EVENT_STATUS_LABELS } from '@/config/events';
import { buildBarOperationalControls, buildMultiBarOperationalHandoffSummary } from '@/lib/bar-service-operational-controls';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventBarMasterTemplatePanelData } from '@/services/bar-master-templates/queries';
import { getEventChecklistItems, getEventOperationalHandoffState } from '@/services/events/queries';
import { getEventInventorySectionData } from '@/services/inventory/queries';
import type {
  AssistantLightContext,
  EmployeeAssignedEvent,
  EmployeeEventReportRecord,
  EmployeeReportEvidenceRecord,
  TeamLeaderBonusRecommendationRecord,
  TeamLeaderBonusReviewItem,
  TeamLeaderExecutionContext,
  TeamLeaderQcCheckpointLogRecord,
  TeamLeaderQcCheckpointRecord,
  TeamLeaderQcCheckpointReviewItem,
} from '@/types/employees';
import type { EventRecord } from '@/types/events';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getAssignmentsByProfile(profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EmployeeAssignedEvent[];

  const today = getTodayIsoDate();
  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, assignment_role, assignment_status, note, events!inner(*)')
    .eq('profile_id', profileId)
    .neq('events.status', 'cancelado')
    .gte('events.event_date', today)
    .order('event_date', { referencedTable: 'events', ascending: true })
    .order('event_time', { referencedTable: 'events', ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    event_id: string;
    assignment_role: EmployeeAssignedEvent['assignmentRole'];
    assignment_status: EmployeeAssignedEvent['assignmentStatus'];
    note: string | null;
    events: EventRecord | EventRecord[];
  }>;

  const mapped = rows
    .map((row) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!event) return null;

      return {
        event,
        assignmentId: row.id,
        assignmentRole: row.assignment_role,
        assignmentStatus: row.assignment_status,
        assignmentNote: row.note,
      } satisfies EmployeeAssignedEvent;
    })
    .filter(Boolean);

  return mapped as EmployeeAssignedEvent[];
}

async function ensureTeamLeaderQcCheckpoints(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  eventId: string,
  assignmentId: string,
) {
  const payload = TEAM_LEADER_QC_CHECKPOINT_SEQUENCE.map((checkpointKey, index) => ({
    event_id: eventId,
    team_leader_assignment_id: assignmentId,
    checkpoint_key: checkpointKey,
    status: 'pending',
    order_index: index + 1,
  }));

  await supabase.from('team_leader_qc_checkpoints').upsert(payload, { onConflict: 'event_id,team_leader_assignment_id,checkpoint_key' });
}

async function getTeamLeaderQcCheckpoints(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  eventId: string,
  assignmentId: string,
) {
  await ensureTeamLeaderQcCheckpoints(supabase, eventId, assignmentId);

  const { data } = await supabase
    .from('team_leader_qc_checkpoints')
    .select('*')
    .eq('event_id', eventId)
    .eq('team_leader_assignment_id', assignmentId);

  const checkpointRows = (data ?? []) as Omit<TeamLeaderQcCheckpointRecord, 'history' | 'latest_submission_kind'>[];
  const logsByCheckpoint = await getCheckpointLogsMap(supabase, checkpointRows.map((item) => item.id));
  const orderMap = new Map(TEAM_LEADER_QC_CHECKPOINT_SEQUENCE.map((item, index) => [item, index]));
  return checkpointRows
    .map((item) => {
      const history = logsByCheckpoint[item.id] ?? [];
      const latestSubmission = history.find((log) => log.action_kind === 'resubmitted' || log.action_kind === 'submitted');
      return {
        ...item,
        history,
        latest_submission_kind: latestSubmission?.action_kind === 'resubmitted' ? 'resubmitted' : latestSubmission?.action_kind === 'submitted' ? 'submitted' : null,
      } satisfies TeamLeaderQcCheckpointRecord;
    })
    .sort((left, right) => {
      const leftOrder = orderMap.get(left.checkpoint_key) ?? 999;
      const rightOrder = orderMap.get(right.checkpoint_key) ?? 999;
      return leftOrder - rightOrder;
    });
}

export async function getEmployeeAppPageData(profileId: string) {
  const assignments = await getAssignmentsByProfile(profileId);
  const today = getTodayIsoDate();
  const todayAssignment = assignments.find((item) => item.event.event_date === today) ?? null;
  const upcomingAssignments = assignments.filter((item) => item.event.event_date > today);

  const projectedTotalMxn = assignments.reduce((sum, item) => sum + EMPLOYEE_ROLE_PROJECTION_MXN[item.assignmentRole], 0);
  const projectedTodayMxn = todayAssignment ? EMPLOYEE_ROLE_PROJECTION_MXN[todayAssignment.assignmentRole] : 0;
  const teamLeaderExecution = await getTeamLeaderExecutionContext(profileId);
  const assistantLight = await getAssistantLightContext(profileId);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      todayAssignment,
      upcomingAssignments,
      projectedTotalMxn,
      projectedTodayMxn,
      releasedBonusMxn: 0,
      recentReports: [] as EmployeeEventReportRecord[],
      recentReportEvidences: {} as Record<string, Array<EmployeeReportEvidenceRecord & { signed_url: string | null }>>,
      teamLeaderExecution,
      assistantLight,
    };
  }

  const [{ data: bonusRows }, { data: recentReports }] = await Promise.all([
    supabase
      .from('employee_event_reports')
      .select('bonus_amount')
      .eq('reporter_profile_id', profileId)
      .eq('review_status', 'bonus_liberado'),
    supabase
      .from('employee_event_reports')
      .select('*')
      .eq('reporter_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const releasedBonusMxn = ((bonusRows ?? []) as Array<{ bonus_amount: number | null }>).reduce((sum, row) => sum + (row.bonus_amount ?? 0), 0);
  const recentReportRows = (recentReports ?? []) as EmployeeEventReportRecord[];
  const reportIds = recentReportRows.map((item) => item.id);
  const { data: evidenceRows } = reportIds.length
    ? await supabase
        .from('employee_report_evidences')
        .select('*')
        .in('report_id', reportIds)
        .eq('is_discarded', false)
        .order('created_at', { ascending: false })
    : { data: [] };

  const evidenceByReport = (evidenceRows ?? []).reduce<Record<string, EmployeeReportEvidenceRecord[]>>((acc, row) => {
    const typed = row as EmployeeReportEvidenceRecord;
    if (!acc[typed.report_id]) acc[typed.report_id] = [];
    acc[typed.report_id].push(typed);
    return acc;
  }, {});

  const recentReportEvidences = await buildSignedEvidenceMap(supabase, evidenceByReport);

  return {
    todayAssignment,
    upcomingAssignments,
    projectedTotalMxn,
    projectedTodayMxn,
    releasedBonusMxn,
    recentReports: recentReportRows,
    recentReportEvidences,
    teamLeaderExecution,
    assistantLight,
  };
}

export async function getTeamLeaderExecutionContext(profileId: string): Promise<TeamLeaderExecutionContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const today = getTodayIsoDate();
  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, assignment_role, assignment_status, is_team_leader_responsible, events!inner(*)')
    .eq('profile_id', profileId)
    .in('assignment_status', ['accepted', 'confirmado'])
    .neq('events.status', 'cancelado')
    .gte('events.event_date', today)
    .order('event_date', { referencedTable: 'events', ascending: true })
    .order('event_time', { referencedTable: 'events', ascending: true })
    .limit(12);

  const rows = (data ?? []) as Array<{
    id: string;
    event_id: string;
    assignment_role: EmployeeAssignedEvent['assignmentRole'];
    assignment_status: EmployeeAssignedEvent['assignmentStatus'];
    is_team_leader_responsible: boolean;
    events: EventRecord | EventRecord[];
  }>;

  const eligibleAssignments = rows
    .map((row) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!event) return null;
      const isTeamLeaderContext =
        row.assignment_role === 'team_leader' || row.assignment_role === 'lider' || row.is_team_leader_responsible;
      if (!isTeamLeaderContext) return null;

      return {
        assignmentId: row.id,
        event,
      };
    })
    .filter(Boolean) as Array<{ assignmentId: string; event: EventRecord }>;

  if (eligibleAssignments.length === 0) return null;

  const assignment = eligibleAssignments.find((item) => item.event.event_date === today) ?? eligibleAssignments[0];
  const [inventoryData, checklistItems, handoffState, barMasterPanel, qcCheckpoints] = await Promise.all([
    getEventInventorySectionData(assignment.event.id),
    getEventChecklistItems(assignment.event.id),
    getEventOperationalHandoffState(assignment.event.id),
    getEventBarMasterTemplatePanelData(assignment.event.id),
    getTeamLeaderQcCheckpoints(supabase, assignment.event.id, assignment.assignmentId),
  ]);

  const itemById = new Map(inventoryData.inventoryItems.map((item) => [item.id, item]));
  const requirements = inventoryData.requirements.map((requirement) => {
    const item = itemById.get(requirement.inventory_item_id) ?? null;
    const availableStock = Math.max(Number(inventoryData.availabilityByItem[requirement.inventory_item_id]?.availableStock ?? 0), 0);
    const requiredQuantity = Number(requirement.quantity_required ?? 0);
    const quantityToBuy = Math.max(requiredQuantity - availableStock, 0);
    const quantityToPull = Math.max(Math.min(requiredQuantity, availableStock), 0);

    return {
      requirement,
      item,
      executionState: inventoryData.executionStateByRequirement[requirement.id] ?? null,
      closeoutState: inventoryData.closeoutStateByRequirement[requirement.id] ?? null,
      quantityToBuy,
      quantityToPull,
    };
  });

  const checklistProgress = {
    total: checklistItems.length,
    completed: checklistItems.filter((item) => item.is_completed).length,
    pending: checklistItems.filter((item) => !item.is_completed).length,
  };

  const barServices = await Promise.all(
    barMasterPanel.applications.map(async (application) => {
      const templateFromPanel = barMasterPanel.templates.find((template) => template.id === application.template_id) ?? null;
      const template = templateFromPanel ?? await (async () => {
        const { data } = await supabase
          .from('bar_master_templates')
          .select('*')
          .eq('id', application.template_id)
          .maybeSingle();
        return data;
      })();
      if (!template) return null;

      const controls = buildBarOperationalControls({
        selectedTemplate: template,
        latestApplication: application,
        requirements: inventoryData.requirements,
        availabilityByItem: inventoryData.availabilityByItem,
        executionStateByRequirement: inventoryData.executionStateByRequirement,
        checklistProgress,
      });
      const approvedByName = application.approved_by
        ? await (async () => {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', application.approved_by)
            .maybeSingle();
          return data?.full_name ?? null;
        })()
        : null;
      const summary = application.result_summary ?? {};

      return {
        applicationId: application.id,
        templateId: template.id,
        templateName: template.name,
        prepGuide: template.prep_guide ?? null,
        executionGuide: template.execution_guide ?? null,
        checklistGuidance: template.checklist_guidance ?? null,
        appliedAt: application.applied_at,
        readinessLabel: controls?.readinessLabel ?? 'Incompleta',
        readiness: controls?.readiness ?? 'incompleta',
        checks: controls?.checks ?? [],
        approvalStatus: application.approval_status ?? 'not_approved',
        approvedByName,
        approvedAt: application.approved_at ?? null,
        approvalNote: application.approval_note ?? null,
        summary: {
          totalTemplateItems: Number(summary.total_template_items ?? 0),
          linkedItemsCount: Number(summary.linked_items_count ?? 0),
          scaledItemsCount: Number(summary.scaled_items_count ?? 0),
          insertedCount: Number(summary.inserted_count ?? 0),
          updatedCount: Number(summary.updated_count ?? 0),
          skippedCount: Number(summary.skipped_without_inventory_link ?? 0),
          omittedItems: Array.isArray(summary.omitted_items) ? summary.omitted_items.map((item) => String(item)) : [],
        },
      } satisfies TeamLeaderExecutionContext['barServices'][number];
    }),
  );
  const resolvedBarServices = barServices.filter((item): item is NonNullable<typeof item> => Boolean(item));
  const barAggregate = {
    total: resolvedBarServices.length,
    approved: resolvedBarServices.filter((item) => item.approvalStatus === 'approved').length,
    risk: resolvedBarServices.filter((item) => item.readiness === 'en_riesgo').length,
    incomplete: resolvedBarServices.filter((item) => item.readiness === 'incompleta').length,
    ready: resolvedBarServices.filter((item) => item.readiness === 'lista_para_ejecucion').length,
  };
  const handoffSnapshot = buildMultiBarOperationalHandoffSummary({
    bars: resolvedBarServices.map((bar) => ({
      templateName: bar.templateName,
      approvalStatus: bar.approvalStatus,
      readinessLabel: bar.readinessLabel,
      checks: bar.checks,
      summary: {
        skippedCount: bar.summary.skippedCount,
        scaledItemsCount: bar.summary.scaledItemsCount,
        insertedCount: bar.summary.insertedCount,
        updatedCount: bar.summary.updatedCount,
      },
    })),
  });

  return {
    assignmentId: assignment.assignmentId,
    event: assignment.event,
    handoffStatus: handoffState?.handoff_status ?? 'draft',
    handoffNote: handoffState?.ready_note ?? null,
    barServices: resolvedBarServices,
    barAggregate,
    handoffSnapshot,
    shoppingList: requirements.filter((row) => row.quantityToBuy > 0),
    pickingList: requirements.filter((row) => row.quantityToPull > 0),
    checklistItems,
    qcCheckpoints,
  };
}

export async function getAssistantLightContext(profileId: string): Promise<AssistantLightContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const today = getTodayIsoDate();
  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, assignment_role, assignment_status, events!inner(*)')
    .eq('profile_id', profileId)
    .in('assignment_status', ['accepted', 'confirmado'])
    .in('assignment_role', ['assistant', 'apoyo'])
    .neq('events.status', 'cancelado')
    .gte('events.event_date', today)
    .order('event_date', { referencedTable: 'events', ascending: true })
    .order('event_time', { referencedTable: 'events', ascending: true })
    .limit(8);

  const rows = (data ?? []) as Array<{
    id: string;
    event_id: string;
    assignment_role: EmployeeAssignedEvent['assignmentRole'];
    assignment_status: EmployeeAssignedEvent['assignmentStatus'];
    events: EventRecord | EventRecord[];
  }>;

  if (rows.length === 0) return null;
  const mapped = rows
    .map((row) => {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!event) return null;
      return { assignmentId: row.id, event };
    })
    .filter(Boolean) as Array<{ assignmentId: string; event: EventRecord }>;
  if (mapped.length === 0) return null;

  const assignment = mapped.find((item) => item.event.event_date === today) ?? mapped[0];

  const [inventoryData, checklistItems, handoffState, teamLeaderLookup] = await Promise.all([
    getEventInventorySectionData(assignment.event.id),
    getEventChecklistItems(assignment.event.id),
    getEventOperationalHandoffState(assignment.event.id),
    supabase
      .from('event_staff_assignments')
      .select('id, profile_id, is_team_leader_responsible, assignment_role, profiles!inner(full_name)')
      .eq('event_id', assignment.event.id)
      .in('assignment_status', ['accepted', 'confirmado']),
  ]);

  const teamLeaderRows = (teamLeaderLookup.data ?? []) as Array<{
    id: string;
    profile_id: string;
    is_team_leader_responsible: boolean;
    assignment_role: string;
    profiles: { full_name: string | null } | Array<{ full_name: string | null }>;
  }>;
  const responsibleTeamLeader = teamLeaderRows.find((row) => row.is_team_leader_responsible)
    ?? teamLeaderRows.find((row) => row.assignment_role === 'team_leader' || row.assignment_role === 'lider')
    ?? null;
  const teamLeaderProfile = responsibleTeamLeader
    ? (Array.isArray(responsibleTeamLeader.profiles) ? responsibleTeamLeader.profiles[0] : responsibleTeamLeader.profiles)
    : null;

  const itemById = new Map(inventoryData.inventoryItems.map((item) => [item.id, item]));
  const requirements = inventoryData.requirements.map((requirement) => {
    const item = itemById.get(requirement.inventory_item_id) ?? null;
    const availableStock = Math.max(Number(inventoryData.availabilityByItem[requirement.inventory_item_id]?.availableStock ?? 0), 0);
    const requiredQuantity = Number(requirement.quantity_required ?? 0);
    const quantityToBuy = Math.max(requiredQuantity - availableStock, 0);
    const quantityToPull = Math.max(Math.min(requiredQuantity, availableStock), 0);

    return {
      requirement,
      item,
      executionState: inventoryData.executionStateByRequirement[requirement.id] ?? null,
      closeoutState: inventoryData.closeoutStateByRequirement[requirement.id] ?? null,
      quantityToBuy,
      quantityToPull,
    };
  });

  return {
    assignmentId: assignment.assignmentId,
    event: assignment.event,
    eventStatusLabel: EVENT_STATUS_LABELS[assignment.event.status],
    teamLeaderName: teamLeaderProfile?.full_name ?? null,
    teamLeaderAssignmentId: responsibleTeamLeader?.id ?? null,
    handoffStatus: handoffState?.handoff_status ?? 'draft',
    checklistItems,
    shoppingList: requirements.filter((row) => row.quantityToBuy > 0),
    pickingList: requirements.filter((row) => row.quantityToPull > 0),
  };
}

export async function getEmployeeAssignmentById(assignmentId: string, profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, profile_id, assignment_role, assignment_status, note, events!inner(*)')
    .eq('id', assignmentId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    event_id: string;
    profile_id: string;
    assignment_role: EmployeeAssignedEvent['assignmentRole'];
    assignment_status: EmployeeAssignedEvent['assignmentStatus'];
    note: string | null;
    events: EventRecord | EventRecord[];
  };
  const event = Array.isArray(row.events) ? row.events[0] : row.events;
  if (!event) return null;

  return {
    event,
    assignmentId: row.id,
    assignmentRole: row.assignment_role,
    assignmentStatus: row.assignment_status,
    assignmentNote: row.note,
  } satisfies EmployeeAssignedEvent;
}

export async function getEmployeeReviewQueuePageData(filters?: {
  status?: string;
  reporterProfileId?: string;
  eventId?: string;
  recentDays?: string;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  let query = supabase.from('employee_event_reports').select('*').order('created_at', { ascending: false }).limit(80);
  if (filters?.status && filters.status !== 'todos') query = query.eq('review_status', filters.status);
  if (filters?.reporterProfileId && filters.reporterProfileId !== 'todos') query = query.eq('reporter_profile_id', filters.reporterProfileId);
  if (filters?.eventId && filters.eventId !== 'todos') query = query.eq('event_id', filters.eventId);
  if (filters?.recentDays && filters.recentDays !== 'todos') {
    const days = Number(filters.recentDays);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }
  }

  const { data: reportsData } = await query;
  const reports = (reportsData ?? []) as EmployeeEventReportRecord[];
  if (reports.length === 0) {
    return [] as Array<
      EmployeeEventReportRecord & {
        events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
        profiles: { id: string; full_name: string | null };
        evidences: Array<EmployeeReportEvidenceRecord & { signed_url: string | null; uploaded_by_name: string | null }>;
      }
    >;
  }

  const eventIds = [...new Set(reports.map((item) => item.event_id))];
  const profileIds = [...new Set(reports.map((item) => item.reporter_profile_id))];

  const [{ data: eventsData }, { data: profilesData }] = await Promise.all([
    supabase.from('events').select('id, event_date, event_time, booked_service, location').in('id', eventIds),
    supabase.from('profiles').select('id, full_name').in('id', profileIds),
  ]);

  const eventsMap = Object.fromEntries(
    ((eventsData ?? []) as Array<Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>>).map((event) => [event.id, event]),
  );
  const profilesMap = Object.fromEntries(((profilesData ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [profile.id, profile]));

  const hydratedReports = reports
    .map((report) => ({
      ...report,
      events: eventsMap[report.event_id],
      profiles: profilesMap[report.reporter_profile_id] ?? { id: report.reporter_profile_id, full_name: null },
    }))
    .filter((item) => Boolean(item.events)) as Array<
    EmployeeEventReportRecord & {
      events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
      profiles: { id: string; full_name: string | null };
    }
  >;

  const reportIds = hydratedReports.map((item) => item.id);
  const { data: evidenceRows } = reportIds.length
    ? await supabase.from('employee_report_evidences').select('*').in('report_id', reportIds).order('created_at', { ascending: false })
    : { data: [] };
  const evidenceByReport = (evidenceRows ?? []).reduce<Record<string, EmployeeReportEvidenceRecord[]>>((acc, row) => {
    const typed = row as EmployeeReportEvidenceRecord;
    if (!acc[typed.report_id]) acc[typed.report_id] = [];
    acc[typed.report_id].push(typed);
    return acc;
  }, {});
  const uploaderIds = [...new Set((evidenceRows ?? []).map((row) => (row as EmployeeReportEvidenceRecord).uploaded_by))];
  const { data: uploadersData } = uploaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] };
  const uploadersMap = Object.fromEntries(((uploadersData ?? []) as Array<{ id: string; full_name: string | null }>).map((item) => [item.id, item.full_name]));
  const signedEvidenceByReport = await buildSignedEvidenceMap(supabase, evidenceByReport);

  return hydratedReports.map((report) => ({
    ...report,
    evidences: (signedEvidenceByReport[report.id] ?? []).map((item) => ({
      ...item,
      uploaded_by_name: uploadersMap[item.uploaded_by] ?? null,
    })),
  })) as Array<
    EmployeeEventReportRecord & {
      events: Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>;
      profiles: { id: string; full_name: string | null };
      evidences: Array<EmployeeReportEvidenceRecord & { signed_url: string | null; uploaded_by_name: string | null }>;
    }
  >;
}

export async function getEmployeeReviewFilterOptions() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      reporters: [] as Array<{ id: string; full_name: string | null }>,
      events: [] as Array<{ id: string; event_date: string; event_time: string | null; event_type: string | null }>,
    };
  }

  const [{ data: reporters }, { data: events }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').order('full_name', { ascending: true }),
    supabase.from('events').select('id, event_date, event_time, event_type').order('event_date', { ascending: false }).limit(60),
  ]);

  return {
    reporters: (reporters ?? []) as Array<{ id: string; full_name: string | null }>,
    events: (events ?? []) as Array<{ id: string; event_date: string; event_time: string | null; event_type: string | null }>,
  };
}

export async function getTeamLeaderQcReviewQueuePageData(filters?: {
  status?: string;
  reporterProfileId?: string;
  eventId?: string;
  recentDays?: string;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as TeamLeaderQcCheckpointReviewItem[];

  let query = supabase.from('team_leader_qc_checkpoints').select('*').order('updated_at', { ascending: false }).limit(120);
  if (filters?.status && filters.status !== 'todos') {
    if (filters.status === 'submitted' || filters.status === 'approved' || filters.status === 'observed' || filters.status === 'pending') {
      query = query.eq('status', filters.status);
    } else if (filters.status === 'pendiente_revision') query = query.eq('status', 'submitted');
    else if (filters.status === 'aprobado') query = query.eq('status', 'approved');
    else if (filters.status === 'observado' || filters.status === 'requiere_correccion') query = query.eq('status', 'observed');
    else if (filters.status === 'en_revision') query = query.eq('status', 'submitted');
    else if (filters.status === 'bonus_liberado') query = query.eq('status', 'approved');
  }
  if (filters?.eventId && filters.eventId !== 'todos') query = query.eq('event_id', filters.eventId);
  if (filters?.recentDays && filters.recentDays !== 'todos') {
    const days = Number(filters.recentDays);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }
  }

  const { data } = await query;
  const checkpointRows = (data ?? []) as Omit<TeamLeaderQcCheckpointRecord, 'history' | 'latest_submission_kind'>[];
  if (checkpointRows.length === 0) return [] as TeamLeaderQcCheckpointReviewItem[];

  const assignmentIds = [...new Set(checkpointRows.map((item) => item.team_leader_assignment_id))];
  const eventIds = [...new Set(checkpointRows.map((item) => item.event_id))];
  const reportIds = [...new Set(checkpointRows.map((item) => item.report_id).filter((item): item is string => Boolean(item)))];

  const [{ data: assignmentRows }, { data: eventRows }, { data: reportRows }] = await Promise.all([
    supabase.from('event_staff_assignments').select('id, profile_id').in('id', assignmentIds),
    supabase.from('events').select('id, event_date, event_time, booked_service, location').in('id', eventIds),
    reportIds.length ? supabase.from('employee_event_reports').select('*').in('id', reportIds) : Promise.resolve({ data: [] }),
  ]);

  const assignments = (assignmentRows ?? []) as Array<{ id: string; profile_id: string }>;
  const assignmentById = Object.fromEntries(assignments.map((item) => [item.id, item]));
  const teamLeaderIds = [...new Set(assignments.map((item) => item.profile_id))];
  const { data: profileRows } = teamLeaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', teamLeaderIds)
    : { data: [] };
  const profilesMap = Object.fromEntries(((profileRows ?? []) as Array<{ id: string; full_name: string | null }>).map((item) => [item.id, item]));
  const eventsMap = Object.fromEntries(
    ((eventRows ?? []) as Array<Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>>).map((item) => [item.id, item]),
  );
  const reportsMap = Object.fromEntries(((reportRows ?? []) as EmployeeEventReportRecord[]).map((item) => [item.id, item]));

  let filteredRows = checkpointRows;
  if (filters?.reporterProfileId && filters.reporterProfileId !== 'todos') {
    filteredRows = filteredRows.filter((row) => assignmentById[row.team_leader_assignment_id]?.profile_id === filters.reporterProfileId);
  }

  const { data: evidenceRows } = reportIds.length
    ? await supabase.from('employee_report_evidences').select('*').in('report_id', reportIds).order('created_at', { ascending: false })
    : { data: [] };
  const evidenceByReport = (evidenceRows ?? []).reduce<Record<string, EmployeeReportEvidenceRecord[]>>((acc, row) => {
    const typed = row as EmployeeReportEvidenceRecord;
    if (!acc[typed.report_id]) acc[typed.report_id] = [];
    acc[typed.report_id].push(typed);
    return acc;
  }, {});
  const uploaderIds = [...new Set((evidenceRows ?? []).map((row) => (row as EmployeeReportEvidenceRecord).uploaded_by))];
  const { data: uploadersData } = uploaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] };
  const uploadersMap = Object.fromEntries(((uploadersData ?? []) as Array<{ id: string; full_name: string | null }>).map((item) => [item.id, item.full_name]));
  const signedEvidenceByReport = await buildSignedEvidenceMap(supabase, evidenceByReport);
  const logsByCheckpoint = await getCheckpointLogsMap(supabase, filteredRows.map((item) => item.id));

  return filteredRows
    .map((checkpoint) => {
      const event = eventsMap[checkpoint.event_id];
      const assignment = assignmentById[checkpoint.team_leader_assignment_id];
      if (!event || !assignment) return null;
      const profile = profilesMap[assignment.profile_id] ?? { id: assignment.profile_id, full_name: null };
      const report = checkpoint.report_id ? (reportsMap[checkpoint.report_id] ?? null) : null;
      const history = logsByCheckpoint[checkpoint.id] ?? [];
      const latestSubmission = history.find((log) => log.action_kind === 'resubmitted' || log.action_kind === 'submitted');
      return {
        ...checkpoint,
        history,
        latest_submission_kind: latestSubmission?.action_kind === 'resubmitted' ? 'resubmitted' : latestSubmission?.action_kind === 'submitted' ? 'submitted' : null,
        event,
        team_leader_profile: profile,
        report,
        evidences: checkpoint.report_id
          ? (signedEvidenceByReport[checkpoint.report_id] ?? []).map((item) => ({
              ...item,
              uploaded_by_name: uploadersMap[item.uploaded_by] ?? null,
            }))
          : [],
      } satisfies TeamLeaderQcCheckpointReviewItem;
    })
    .filter((item): item is TeamLeaderQcCheckpointReviewItem => Boolean(item));
}

export async function getTeamLeaderBonusReviewQueuePageData(filters?: {
  reporterProfileId?: string;
  eventId?: string;
  recentDays?: string;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as TeamLeaderBonusReviewItem[];

  let checkpointsQuery = supabase
    .from('team_leader_qc_checkpoints')
    .select('id, event_id, team_leader_assignment_id, checkpoint_key, status, created_at')
    .order('updated_at', { ascending: false })
    .limit(300);
  if (filters?.eventId && filters.eventId !== 'todos') checkpointsQuery = checkpointsQuery.eq('event_id', filters.eventId);
  if (filters?.recentDays && filters.recentDays !== 'todos') {
    const days = Number(filters.recentDays);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      checkpointsQuery = checkpointsQuery.gte('created_at', since);
    }
  }

  const { data: checkpointsData } = await checkpointsQuery;
  const checkpoints = (checkpointsData ?? []) as Array<{
    id: string;
    event_id: string;
    team_leader_assignment_id: string;
    checkpoint_key: string;
    status: TeamLeaderQcCheckpointRecord['status'];
    created_at: string;
  }>;
  if (checkpoints.length === 0) return [] as TeamLeaderBonusReviewItem[];

  const groupKey = (eventId: string, assignmentId: string) => `${eventId}::${assignmentId}`;
  const grouped = checkpoints.reduce<Record<string, typeof checkpoints>>((acc, item) => {
    const key = groupKey(item.event_id, item.team_leader_assignment_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const assignmentIds = [...new Set(checkpoints.map((item) => item.team_leader_assignment_id))];
  const eventIds = [...new Set(checkpoints.map((item) => item.event_id))];
  const checkpointIds = checkpoints.map((item) => item.id);

  const [{ data: assignmentRows }, { data: eventRows }, logsByCheckpoint] = await Promise.all([
    supabase.from('event_staff_assignments').select('id, profile_id').in('id', assignmentIds),
    supabase.from('events').select('id, event_date, event_time, booked_service, location').in('id', eventIds),
    getCheckpointLogsMap(supabase, checkpointIds),
  ]);

  const assignments = (assignmentRows ?? []) as Array<{ id: string; profile_id: string }>;
  const assignmentById = Object.fromEntries(assignments.map((row) => [row.id, row]));
  const teamLeaderIds = [...new Set(assignments.map((item) => item.profile_id))];
  const { data: profileRows } = teamLeaderIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', teamLeaderIds)
    : { data: [] };
  const profilesMap = Object.fromEntries(((profileRows ?? []) as Array<{ id: string; full_name: string | null }>).map((item) => [item.id, item]));
  const eventsMap = Object.fromEntries(
    ((eventRows ?? []) as Array<Pick<EventRecord, 'id' | 'event_date' | 'event_time' | 'booked_service' | 'location'>>).map((item) => [item.id, item]),
  );

  const { data: recommendationsData } = await supabase
    .from('team_leader_bonus_recommendations')
    .select('*')
    .in('event_id', eventIds)
    .in('team_leader_assignment_id', assignmentIds);
  const recommendations = (recommendationsData ?? []) as TeamLeaderBonusRecommendationRecord[];
  const recommendationByGroup = Object.fromEntries(recommendations.map((row) => [groupKey(row.event_id, row.team_leader_assignment_id), row]));

  return Object.entries(grouped)
    .map(([key, rows]) => {
      const sample = rows[0];
      const event = eventsMap[sample.event_id];
      const assignment = assignmentById[sample.team_leader_assignment_id];
      if (!event || !assignment) return null;
      if (filters?.reporterProfileId && filters.reporterProfileId !== 'todos' && assignment.profile_id !== filters.reporterProfileId) return null;
      const profile = profilesMap[assignment.profile_id] ?? { id: assignment.profile_id, full_name: null };
      const approved = rows.filter((item) => item.status === 'approved').length;
      const observed = rows.filter((item) => item.status === 'observed').length;
      const submitted = rows.filter((item) => item.status === 'submitted').length;
      const pending = rows.filter((item) => item.status === 'pending').length;
      const resubmittedCount = rows.reduce((sum, row) => {
        const logs = logsByCheckpoint[row.id] ?? [];
        return sum + logs.filter((log) => log.action_kind === 'resubmitted').length;
      }, 0);
      const finalCloseoutApproved = rows.some((item) => item.checkpoint_key === 'final_closeout_inventory' && item.status === 'approved');
      const recommendation = recommendationByGroup[key] ?? {
        id: `draft-${key}`,
        event_id: sample.event_id,
        team_leader_assignment_id: sample.team_leader_assignment_id,
        compliance_status: 'con_observaciones',
        recommendation_status: 'pending',
        suggested_bonus_amount: null,
        supervisor_note: null,
        recommended_by: null,
        recommended_at: null,
        final_decision_status: 'pending',
        final_bonus_amount: null,
        final_note: null,
        decided_by: null,
        decided_at: null,
        created_at: sample.created_at,
        updated_at: sample.created_at,
      } satisfies TeamLeaderBonusRecommendationRecord;

      return {
        recommendation,
        event,
        team_leader_profile: profile,
        checkpoint_context: {
          total: rows.length,
          approved,
          observed,
          submitted,
          pending,
          resubmitted_count: resubmittedCount,
          final_closeout_approved: finalCloseoutApproved,
        },
      } satisfies TeamLeaderBonusReviewItem;
    })
    .filter((item): item is TeamLeaderBonusReviewItem => Boolean(item))
    .sort((left, right) => left.event.event_date.localeCompare(right.event.event_date));
}

async function getCheckpointLogsMap(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  checkpointIds: string[],
) {
  if (checkpointIds.length === 0) return {} as Record<string, TeamLeaderQcCheckpointLogRecord[]>;
  const { data } = await supabase
    .from('team_leader_qc_checkpoint_logs')
    .select('*')
    .in('checkpoint_id', checkpointIds)
    .order('created_at', { ascending: false });

  return ((data ?? []) as TeamLeaderQcCheckpointLogRecord[]).reduce<Record<string, TeamLeaderQcCheckpointLogRecord[]>>((acc, row) => {
    if (!acc[row.checkpoint_id]) acc[row.checkpoint_id] = [];
    acc[row.checkpoint_id].push(row);
    return acc;
  }, {});
}

async function buildSignedEvidenceMap(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  evidenceByReport: Record<string, EmployeeReportEvidenceRecord[]>,
) {
  const result: Record<string, Array<EmployeeReportEvidenceRecord & { signed_url: string | null }>> = {};
  for (const [reportId, rows] of Object.entries(evidenceByReport)) {
    const mapped = await Promise.all(
      rows.map(async (row) => {
        const signed = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60 * 8);
        return {
          ...row,
          signed_url: signed.data?.signedUrl ?? null,
        };
      }),
    );
    result[reportId] = mapped;
  }

  return result;
}
