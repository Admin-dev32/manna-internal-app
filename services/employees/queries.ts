import { notFound } from 'next/navigation';

import { EMPLOYEE_ROLE_PROJECTION_MXN } from '@/config/employees';
import { EVENT_STATUS_LABELS } from '@/config/events';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventChecklistItems, getEventOperationalHandoffState } from '@/services/events/queries';
import { getEventInventorySectionData } from '@/services/inventory/queries';
import type { AssistantLightContext, EmployeeAssignedEvent, EmployeeEventReportRecord, EmployeeReportEvidenceRecord, TeamLeaderExecutionContext } from '@/types/employees';
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
  const [inventoryData, checklistItems, handoffState] = await Promise.all([
    getEventInventorySectionData(assignment.event.id),
    getEventChecklistItems(assignment.event.id),
    getEventOperationalHandoffState(assignment.event.id),
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

  return {
    assignmentId: assignment.assignmentId,
    event: assignment.event,
    handoffStatus: handoffState?.handoff_status ?? 'draft',
    handoffNote: handoffState?.ready_note ?? null,
    shoppingList: requirements.filter((row) => row.quantityToBuy > 0),
    pickingList: requirements.filter((row) => row.quantityToPull > 0),
    checklistItems,
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
