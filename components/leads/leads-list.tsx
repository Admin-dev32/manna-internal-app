'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Eye,
  ListFilter,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  TableProperties,
  UserRound,
  X,
} from 'lucide-react';

import { LeadPriorityBadge, LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { ModulePageLayout } from '@/components/layout/module-page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailDrawer } from '@/components/ui/detail-drawer';
import { Input } from '@/components/ui/input';
import { CommandPalette, type CommandPaletteItem } from '@/components/ui/command-palette';
import { OpsRowSelectionBar, OpsTableShell, OpsTableState, OpsTableToolbar } from '@/components/ui/ops-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { leadPriorityOptions, leadStatusOptions } from '@/config/leads';
import { LEADS_INTELLIGENCE_STORAGE_KEYS, leadAutomationRules } from '@/config/leads-intelligence';
import {
  getLeadIntelligence,
  getAutomationPayloadForLead,
  getNextFollowUpIsoDate,
} from '@/lib/leads/intelligence';
import { buildServiceInterestSummary, parseServiceInterests } from '@/lib/leads/service-interest';
import { updateLeadInlineAction, updateLeadStatusAction } from '@/services/leads/actions';
import { cn } from '@/lib/utils';
import type { LeadPriority, LeadProfileOption, LeadRecord, LeadStatus } from '@/types/leads';

interface LeadsListProps {
  leads: LeadRecord[];
  summary: {
    total: number;
    pendientes: number;
    seguimientoHoy: number;
    altaPrioridad: number;
  };
  profiles: Record<string, LeadProfileOption>;
}

type SortMode = 'follow_up' | 'last_interaction' | 'priority' | 'name';

const priorityWeight = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
} as const;

const statusWeight = Object.fromEntries(leadStatusOptions.map((option, index) => [option.value, index])) as Record<string, number>;

function formatDate(value: string | null, dateOnly = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', dateOnly ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getPrimaryContact(lead: LeadRecord) {
  return lead.email ?? lead.phone ?? 'Sin contacto principal';
}

function getServiceInterestLabel(lead: LeadRecord) {
  return (
    buildServiceInterestSummary(
      parseServiceInterests({
        serviceInterests: lead.service_interests,
        serviceInterest: lead.service_interest,
      }),
    ) || 'Sin definir'
  );
}

function getResponsibleLabel(lead: LeadRecord, profiles: Record<string, LeadProfileOption>) {
  if (!lead.responsible_profile_id) return 'Sin asignar';
  return profiles[lead.responsible_profile_id]?.full_name ?? 'Responsable asignado';
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeInlineDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function matchesSearch(lead: LeadRecord, term: string) {
  const haystack = [
    lead.full_name,
    lead.email,
    lead.phone,
    lead.next_action,
    lead.source_platform,
    getServiceInterestLabel(lead),
    lead.event_type,
    lead.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(term.toLowerCase());
}

export function LeadsList({ leads, summary, profiles }: LeadsListProps) {
  const router = useRouter();
  const [boardLeads, setBoardLeads] = useState(leads);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadRecord['status']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | LeadRecord['priority']>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<'all' | 'unassigned' | string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('follow_up');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [activeDrawerTab, setActiveDrawerTab] = useState('overview');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [interactionFeedback, setInteractionFeedback] = useState<string | null>(null);
  const [suggestionFeedback, setSuggestionFeedback] = useState<Record<string, { applied: number; useful: number; notUseful: number }>>({});
  const [automationEnabled, setAutomationEnabled] = useState<Record<string, boolean>>({});
  const [lastActiveAt, setLastActiveAt] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  useEffect(() => {
    setBoardLeads(leads);
  }, [leads]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(LEADS_INTELLIGENCE_STORAGE_KEYS.filtersCollapsed);
    if (storedValue === 'true') {
      setFiltersCollapsed(true);
    }
    const savedViewState = window.localStorage.getItem(LEADS_INTELLIGENCE_STORAGE_KEYS.viewState);
    if (savedViewState) {
      try {
        const parsed = JSON.parse(savedViewState) as {
          search?: string;
          statusFilter?: 'all' | LeadRecord['status'];
          priorityFilter?: 'all' | LeadRecord['priority'];
          responsibleFilter?: 'all' | 'unassigned' | string;
          sortMode?: SortMode;
        };
        if (parsed.search) setSearch(parsed.search);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
        if (parsed.priorityFilter) setPriorityFilter(parsed.priorityFilter);
        if (parsed.responsibleFilter) setResponsibleFilter(parsed.responsibleFilter);
        if (parsed.sortMode) setSortMode(parsed.sortMode);
      } catch {
        // no-op: si el storage está corrupto, ignoramos y usamos defaults
      }
    }

    const savedFeedback = window.localStorage.getItem(LEADS_INTELLIGENCE_STORAGE_KEYS.suggestionFeedback);
    if (savedFeedback) {
      try {
        setSuggestionFeedback(JSON.parse(savedFeedback) as Record<string, { applied: number; useful: number; notUseful: number }>);
      } catch {
        // no-op
      }
    }

    const savedAutomationPrefs = window.localStorage.getItem(LEADS_INTELLIGENCE_STORAGE_KEYS.automationPrefs);
    if (savedAutomationPrefs) {
      try {
        setAutomationEnabled(JSON.parse(savedAutomationPrefs) as Record<string, boolean>);
      } catch {
        // no-op
      }
    } else {
      setAutomationEnabled(
        Object.fromEntries(leadAutomationRules.map((rule) => [rule.id, rule.enabledByDefault])) as Record<string, boolean>,
      );
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEADS_INTELLIGENCE_STORAGE_KEYS.filtersCollapsed, String(filtersCollapsed));
  }, [filtersCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      LEADS_INTELLIGENCE_STORAGE_KEYS.viewState,
      JSON.stringify({
        search,
        statusFilter,
        priorityFilter,
        responsibleFilter,
        sortMode,
      }),
    );
  }, [priorityFilter, responsibleFilter, search, sortMode, statusFilter]);

  useEffect(() => {
    window.localStorage.setItem(LEADS_INTELLIGENCE_STORAGE_KEYS.suggestionFeedback, JSON.stringify(suggestionFeedback));
  }, [suggestionFeedback]);

  useEffect(() => {
    if (Object.keys(automationEnabled).length === 0) return;
    window.localStorage.setItem(LEADS_INTELLIGENCE_STORAGE_KEYS.automationPrefs, JSON.stringify(automationEnabled));
  }, [automationEnabled]);

  useEffect(() => {
    if (!interactionFeedback) return;
    const timer = window.setTimeout(() => setInteractionFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [interactionFeedback]);

  useEffect(() => {
    const updateActivity = () => setLastActiveAt(Date.now());
    updateActivity();
    window.addEventListener('pointerdown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('pointerdown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTimeMs(Date.now());
    updateCurrentTime();
    const interval = window.setInterval(updateCurrentTime, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const viewCards = [
    { label: 'Total', value: summary.total.toString() },
    { label: 'Pendientes', value: summary.pendientes.toString() },
    { label: 'Seguimiento', value: summary.seguimientoHoy.toString() },
    { label: 'Alta prioridad', value: summary.altaPrioridad.toString() },
  ];

  const filteredAndSortedLeads = useMemo(() => {
    const filtered = boardLeads.filter((lead) => {
      if (search && !matchesSearch(lead, search)) return false;
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false;
      if (responsibleFilter === 'unassigned' && lead.responsible_profile_id) return false;
      if (responsibleFilter !== 'all' && responsibleFilter !== 'unassigned' && lead.responsible_profile_id !== responsibleFilter) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'name') return a.full_name.localeCompare(b.full_name, 'es');
      if (sortMode === 'priority') return priorityWeight[a.priority] - priorityWeight[b.priority];
      if (sortMode === 'last_interaction') return new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime();

      const aTime = a.follow_up_at ? new Date(a.follow_up_at).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.follow_up_at ? new Date(b.follow_up_at).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [boardLeads, priorityFilter, responsibleFilter, search, sortMode, statusFilter]);

  const intelligenceByLeadId = useMemo(
    () =>
      Object.fromEntries(
        boardLeads.map((lead) => [lead.id, getLeadIntelligence(lead)]),
      ) as Record<string, ReturnType<typeof getLeadIntelligence>>,
    [boardLeads],
  );

  const groupedLeads = useMemo(
    () =>
      leadStatusOptions.map((option) => {
        const items = filteredAndSortedLeads.filter((lead) => lead.status === option.value);
	        const overdueCount = items.filter((lead) => intelligenceByLeadId[lead.id]?.followUpTone.label === 'Vencido').length;
        return {
          status: option.value,
          label: option.label,
          items,
          overdueCount,
        };
      }),
    [filteredAndSortedLeads, intelligenceByLeadId],
  );

  const visibleLeadCount = groupedLeads.reduce((accumulator, group) => accumulator + group.items.length, 0);
  const selectedLead = filteredAndSortedLeads.find((lead) => lead.id === selectedLeadId) ?? boardLeads.find((lead) => lead.id === selectedLeadId) ?? null;
  const hasActiveFilters = search || statusFilter !== 'all' || priorityFilter !== 'all' || responsibleFilter !== 'all' || sortMode !== 'follow_up';
  const visibleLeadIds = filteredAndSortedLeads.map((lead) => lead.id);
  const selectedLeads = boardLeads.filter((lead) => selectedLeadIds.includes(lead.id));
  const overdueLeadsCount = filteredAndSortedLeads.filter((lead) => intelligenceByLeadId[lead.id]?.actionSuggestion.urgency === 'critical').length;
  const noFollowUpCount = filteredAndSortedLeads.filter((lead) => intelligenceByLeadId[lead.id]?.needsFollowUpScheduling).length;
  const isIdle = currentTimeMs - lastActiveAt > 1000 * 60 * 2;
  const intelligentTodayActions = filteredAndSortedLeads
    .map((lead) => {
      const intelligence = intelligenceByLeadId[lead.id] ?? getLeadIntelligence(lead);
      return { lead, suggestion: intelligence.actionSuggestion, score: intelligence.scoreBreakdown.score };
    })
    .filter((item) => item.suggestion.urgency === 'critical' || item.suggestion.urgency === 'high')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const openLeadDrawer = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setActiveDrawerTab('overview');
  }, []);

  const moveSelection = useCallback(
    (direction: 'next' | 'prev') => {
      if (visibleLeadIds.length === 0) return;
      if (!selectedLeadId) {
        openLeadDrawer(visibleLeadIds[0]);
        return;
      }
      const currentIndex = visibleLeadIds.indexOf(selectedLeadId);
      if (currentIndex === -1) {
        openLeadDrawer(visibleLeadIds[0]);
        return;
      }
      const nextIndex = direction === 'next'
        ? Math.min(currentIndex + 1, visibleLeadIds.length - 1)
        : Math.max(currentIndex - 1, 0);
      openLeadDrawer(visibleLeadIds[nextIndex]);
    },
    [openLeadDrawer, selectedLeadId, visibleLeadIds],
  );

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target ? ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable : false;
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

      if (isCmdK) {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if (isTypingTarget) return;

      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar leads"]')?.focus();
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        router.push('/leads/nuevo');
      }

      if (event.key === 'Enter' && selectedLeadId) {
        event.preventDefault();
        openLeadDrawer(selectedLeadId);
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection('next');
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection('prev');
      }

      if (event.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (selectedLeadId) setSelectedLeadId(null);
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [isCommandPaletteOpen, moveSelection, openLeadDrawer, router, selectedLeadId]);

  function toggleGroup(status: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [status]: !current[status],
    }));
  }

  const resetBoardControls = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setResponsibleFilter('all');
    setSortMode('follow_up');
  }, []);

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((current) => (current.includes(leadId) ? current.filter((item) => item !== leadId) : [...current, leadId]));
  }

  function clearLeadSelection() {
    setSelectedLeadIds([]);
  }

  function toggleSelectAllVisibleLeads() {
    const allVisibleIds = filteredAndSortedLeads.map((lead) => lead.id);
    const allAlreadySelected = allVisibleIds.length > 0 && allVisibleIds.every((leadId) => selectedLeadIds.includes(leadId));
    setSelectedLeadIds(allAlreadySelected ? [] : allVisibleIds);
  }

  const applyLocalLeadPatch = useCallback((leadId: string, patch: Partial<LeadRecord>) => {
    setBoardLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              ...patch,
              updated_at: new Date().toISOString(),
              last_interaction_at: new Date().toISOString(),
            }
          : lead,
      ),
    );
  }, []);

  function trackSuggestionFeedback(suggestionId: string, type: 'applied' | 'useful' | 'notUseful') {
    setSuggestionFeedback((current) => {
      const previous = current[suggestionId] ?? { applied: 0, useful: 0, notUseful: 0 };
      return {
        ...current,
        [suggestionId]: {
          ...previous,
          [type]: previous[type] + 1,
        },
      };
    });
  }

  const applyLeadAutomationRules = useCallback(async (targetLeads: LeadRecord[]) => {
    const followUpAt = getNextFollowUpIsoDate(1);

    let affected = 0;
    for (const lead of targetLeads) {
      const payload = getAutomationPayloadForLead({
        lead,
        intelligence: intelligenceByLeadId[lead.id] ?? getLeadIntelligence(lead),
        rules: leadAutomationRules,
        enabledRules: automationEnabled,
        followUpAt,
      });
      const updates: Partial<LeadRecord> = {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.followUpAt ? { follow_up_at: payload.followUpAt } : {}),
      };

      if (Object.keys(payload).length === 0) continue;
      await updateLeadInlineAction(lead.id, payload);
      applyLocalLeadPatch(lead.id, updates);
      affected += 1;
    }

    return affected;
  }, [automationEnabled]);

  const applySmartBulkFollowUp = useCallback(async () => {
    const candidateLeads = selectedLeads.filter((lead) => (intelligenceByLeadId[lead.id] ?? getLeadIntelligence(lead)).needsFollowUpScheduling);
    if (candidateLeads.length === 0) {
      setInteractionFeedback('No hay leads seleccionados que necesiten seguimiento.');
      return;
    }

    const affected = await applyLeadAutomationRules(candidateLeads);
    trackSuggestionFeedback('schedule-follow-up', 'applied');
    setInteractionFeedback(`Sugerencia aplicada: ${affected} leads con seguimiento programado.`);
    clearLeadSelection();
    router.refresh();
  }, [applyLeadAutomationRules, intelligenceByLeadId, router, selectedLeads]);

  async function handleLeadStatusChange(leadId: string, nextStatus: LeadStatus) {
    const previousLeads = boardLeads;
    setStatusUpdateError(null);
    setPendingLeadId(leadId);
    applyLocalLeadPatch(leadId, { status: nextStatus });

    const result = await updateLeadStatusAction(leadId, nextStatus);

    if (!result.success) {
      setBoardLeads(previousLeads);
      setStatusUpdateError(result.error ?? 'No pudimos mover el lead al nuevo grupo.');
    } else {
      setInteractionFeedback('Estado actualizado');
      router.refresh();
    }

    setPendingLeadId(null);
  }

  async function handleInlineLeadUpdate(leadId: string, patch: Partial<LeadRecord>) {
    const previousLeads = boardLeads;
    setStatusUpdateError(null);
    setPendingLeadId(leadId);
    applyLocalLeadPatch(leadId, patch);

    const result = await updateLeadInlineAction(leadId, {
      status: patch.status,
      priority: patch.priority,
      responsibleProfileId: Object.prototype.hasOwnProperty.call(patch, 'responsible_profile_id') ? (patch.responsible_profile_id ?? null) : undefined,
      followUpAt: Object.prototype.hasOwnProperty.call(patch, 'follow_up_at') ? patch.follow_up_at ?? null : undefined,
      nextAction: patch.next_action,
    });

    if (!result.success) {
      setBoardLeads(previousLeads);
      setStatusUpdateError(result.error ?? 'No pudimos guardar el cambio rápido del lead.');
    } else {
      setInteractionFeedback('Cambios guardados');
      router.refresh();
    }

    setPendingLeadId(null);
  }

  const commandItems = useMemo(() => {
    const baseItems: CommandPaletteItem[] = [
      {
        id: 'new-lead',
        label: 'Crear nuevo lead',
        hint: 'N',
        keywords: ['crear', 'nuevo', 'lead'],
        onSelect: () => router.push('/leads/nuevo'),
      },
      {
        id: 'focus-search',
        label: 'Enfocar búsqueda',
        hint: '/',
        keywords: ['buscar', 'filtro', 'search'],
        onSelect: () => document.querySelector<HTMLInputElement>('input[aria-label=\"Buscar leads\"]')?.focus(),
      },
      {
        id: 'clear-filters',
        label: 'Limpiar filtros',
        hint: 'reset',
        keywords: ['limpiar', 'filtros'],
        onSelect: () => resetBoardControls(),
      },
      {
        id: 'open-first',
        label: 'Abrir primer lead visible',
        hint: 'Enter',
        keywords: ['abrir', 'drawer', 'detalle'],
        onSelect: () => {
          if (visibleLeadIds[0]) openLeadDrawer(visibleLeadIds[0]);
        },
      },
    ];

    if (selectedLead) {
      baseItems.push({
        id: 'selected-followup-tab',
        label: `Abrir actividad de ${selectedLead.full_name}`,
        hint: 'drawer',
        keywords: ['actividad', 'timeline', 'lead'],
        onSelect: () => {
          openLeadDrawer(selectedLead.id);
          setActiveDrawerTab('activity');
        },
      });
    }

    if (selectedLeads.length > 0) {
      baseItems.push({
        id: 'smart-bulk-followup',
        label: 'Aplicar sugerencia masiva: programar seguimiento',
        hint: `${selectedLeads.length} seleccionados`,
        keywords: ['bulk', 'seguimiento', 'inteligencia'],
        onSelect: () => {
          void applySmartBulkFollowUp();
        },
      });
    }

    return baseItems;
  }, [applySmartBulkFollowUp, openLeadDrawer, resetBoardControls, router, selectedLead, selectedLeads.length, visibleLeadIds]);

  return (
    <ModulePageLayout
      badge="Comercial"
      title="Leads"
      description="Pipeline diario para seguimiento comercial, organización por estado y decisiones rápidas sin perder contexto."
      breadcrumbs={[{ label: 'Comercial' }, { label: 'Leads' }]}
      headerActions={(
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[420px]">
          {viewCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      )}
      className="pb-10"
    >

      {statusUpdateError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">{statusUpdateError}</CardContent>
        </Card>
      ) : null}
      {interactionFeedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 transition-all">
          {interactionFeedback}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Panel inteligente del día</CardTitle>
          <CardDescription>Prioridades sugeridas automáticamente con base en urgencia + score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {intelligentTodayActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay alertas críticas en este momento.</p>
          ) : (
            intelligentTodayActions.map((item) => (
              <button
                key={item.lead.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/5"
                onClick={() => openLeadDrawer(item.lead.id)}
              >
                <div>
                  <p className="font-medium text-foreground">{item.lead.full_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.suggestion.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.suggestion.urgency === 'critical' ? 'warning' : 'secondary'}>{item.suggestion.urgency}</Badge>
                  <Badge variant="outline">Score {item.score}</Badge>
                </div>
              </button>
            ))
          )}
          <div className="rounded-2xl border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reglas automáticas</p>
            <div className="mt-2 grid gap-2">
              {leadAutomationRules.map((rule) => (
                <label key={rule.id} className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(automationEnabled[rule.id])}
                    onChange={(event) => setAutomationEnabled((current) => ({ ...current, [rule.id]: event.target.checked }))}
                  />
                  <span>
                    <span className="font-medium">{rule.label}</span>
                    <span className="block text-xs text-muted-foreground">{rule.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <OpsTableShell className="sticky top-4 z-20 border-border/80 shadow-sm">
        <OpsTableToolbar
          searchSlot={(
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar leads"
                className="pl-10"
                placeholder="Buscar por nombre, contacto, plataforma, acción o servicio"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          )}
          actionsSlot={(
            <>
              <Button type="button" size="sm">
                <TableProperties className="size-4" />
                Tabla
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setFiltersCollapsed((current) => !current)}>
                <ListFilter className="size-4" />
                {filtersCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
              </Button>
              <Button asChild>
                <Link href="/leads/nuevo">
                  <Plus className="size-4" />
                  Nuevo lead
                </Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsCommandPaletteOpen(true)}>
                ⌘K
              </Button>
            </>
          )}
          metaSlot={(
            <>
              <Badge variant="secondary">{visibleLeadCount} leads visibles</Badge>
              <Badge variant="outline">Agrupado por estado</Badge>
              {overdueLeadsCount > 0 ? <Badge variant="warning">{overdueLeadsCount} críticos</Badge> : null}
              {noFollowUpCount > 0 ? <Badge variant="outline">{noFollowUpCount} sin seguimiento</Badge> : null}
              {hasActiveFilters ? <Badge variant="outline">Filtros activos</Badge> : null}
            </>
          )}
          filtersSlot={!filtersCollapsed ? (
            <>
              <SelectControl
                icon={<ListFilter className="size-4 text-muted-foreground" />}
                label="Estado"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                options={[{ value: 'all', label: 'Todos los estados' }, ...leadStatusOptions.map((option) => ({ value: option.value, label: option.label }))]}
              />
              <SelectControl
                icon={<SlidersHorizontal className="size-4 text-muted-foreground" />}
                label="Prioridad"
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value as typeof priorityFilter)}
                options={[
                  { value: 'all', label: 'Todas las prioridades' },
                  { value: 'urgente', label: 'Urgente' },
                  { value: 'alta', label: 'Alta' },
                  { value: 'media', label: 'Media' },
                  { value: 'baja', label: 'Baja' },
                ]}
              />
              <SelectControl
                icon={<UserRound className="size-4 text-muted-foreground" />}
                label="Responsable"
                value={responsibleFilter}
                onChange={setResponsibleFilter}
                options={[
                  { value: 'all', label: 'Todos los responsables' },
                  { value: 'unassigned', label: 'Sin asignar' },
                  ...Object.values(profiles).map((profile) => ({ value: profile.id, label: profile.full_name ?? profile.id })),
                ]}
              />
              <SelectControl
                icon={<CalendarClock className="size-4 text-muted-foreground" />}
                label="Orden"
                value={sortMode}
                onChange={(value) => setSortMode(value as SortMode)}
                options={[
                  { value: 'follow_up', label: 'Seguimiento más cercano' },
                  { value: 'last_interaction', label: 'Última interacción' },
                  { value: 'priority', label: 'Mayor prioridad' },
                  { value: 'name', label: 'Nombre A-Z' },
                ]}
              />
              <div className="flex items-end">
                {hasActiveFilters ? (
                  <Button type="button" variant="ghost" size="sm" onClick={resetBoardControls}>
                    <X className="size-4" />
                    Limpiar
                  </Button>
                ) : null}
              </div>
            </>
          ) : undefined}
        />
      </OpsTableShell>

      <OpsRowSelectionBar selectedCount={selectedLeadIds.length}>
        <Button type="button" size="sm" onClick={() => void applySmartBulkFollowUp()}>
          Sugerencia inteligente
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clearLeadSelection}>
          Limpiar selección
        </Button>
      </OpsRowSelectionBar>

      {isIdle ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Sin actividad reciente. Revisa leads críticos o usa ⌘K para ejecutar una acción sugerida.
        </div>
      ) : null}

      {visibleLeadCount === 0 ? (
        <div className="space-y-4">
          <OpsTableState
            kind="empty"
            title="No hay leads que coincidan con la búsqueda actual."
            description="Ajusta filtros, limpia la búsqueda o crea un nuevo lead para seguir operando."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={resetBoardControls}>
              Limpiar filtros
            </Button>
            <Button asChild>
              <Link href="/leads/nuevo">Nuevo lead</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedLeads
            .filter((group) => group.items.length > 0)
            .sort((a, b) => statusWeight[a.status] - statusWeight[b.status])
            .map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.status]);

              return (
                <Card key={group.status} className="overflow-hidden border-border/80">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 border-b border-border/60 bg-muted/25 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:px-5"
                    onClick={() => toggleGroup(group.status)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {isCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
                          <Badge variant="secondary">{group.items.length} items</Badge>
                          {group.overdueCount > 0 ? <Badge variant="warning">{group.overdueCount} vencidos</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">Si cambias el estado, el lead se reubica automáticamente en el grupo correcto.</p>
                      </div>
                    </div>
                  </button>

                  {!isCollapsed ? (
                    <CardContent className="p-0">
                      <div className="hidden xl:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[56px]">
                                <input
                                  type="checkbox"
                                  aria-label="Seleccionar todos los leads visibles"
                                  checked={filteredAndSortedLeads.length > 0 && filteredAndSortedLeads.every((lead) => selectedLeadIds.includes(lead.id))}
                                  onChange={toggleSelectAllVisibleLeads}
                                  onClick={(event) => event.stopPropagation()}
                                />
                              </TableHead>
                              <TableHead className="min-w-[220px]">Nombre</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead className="min-w-[170px]">Estado</TableHead>
                              <TableHead>Prioridad</TableHead>
                              <TableHead className="min-w-[170px]">Responsable</TableHead>
                              <TableHead className="min-w-[150px]">Fecha tentativa</TableHead>
                              <TableHead className="min-w-[170px]">Seguimiento</TableHead>
                              <TableHead className="min-w-[220px]">Próxima acción</TableHead>
                              <TableHead className="min-w-[160px]">Origen</TableHead>
                              <TableHead className="min-w-[160px]">Servicio</TableHead>
                              <TableHead>Invitados</TableHead>
                              <TableHead className="min-w-[170px]">Última interacción</TableHead>
                              <TableHead className="w-[160px]">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((lead) => {
                              const detailHref = `/leads/${lead.id}` as Route;
                              const editHref = `/leads/${lead.id}/editar` as Route;
                              const intelligence = intelligenceByLeadId[lead.id] ?? getLeadIntelligence(lead);
                              const followUpTone = intelligence.followUpTone;
                              const tentativeDateTone = intelligence.tentativeDateTone;
                              const leadSignals = intelligence.signals;
                              const urgencyBadge = intelligence.urgencyBadge;
                              const scoreBreakdown = intelligence.scoreBreakdown;

                              return (
                                <TableRow
                                  key={lead.id}
                                  className={cn(
                                    'group/row cursor-pointer align-top',
                                    followUpTone.label === 'Vencido' && 'bg-amber-50/60',
                                    lead.priority === 'urgente' && 'border-l-2 border-l-rose-300',
                                    selectedLeadIds.includes(lead.id) && 'bg-primary/5',
                                  )}
                                  onClick={() => setSelectedLeadId(lead.id)}
                                >
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      aria-label={`Seleccionar ${lead.full_name}`}
                                      checked={selectedLeadIds.includes(lead.id)}
                                      onChange={() => toggleLeadSelection(lead.id)}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={scoreBreakdown.score >= 75 ? 'success' : scoreBreakdown.score >= 50 ? 'secondary' : 'outline'}>
                                      {scoreBreakdown.score}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-2">
                                      <button
                                        type="button"
                                        className="text-left font-semibold text-foreground transition-colors hover:text-primary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedLeadId(lead.id);
                                        }}
                                      >
                                        {lead.full_name}
                                      </button>
                                      <p className="text-xs text-muted-foreground">{getPrimaryContact(lead)}</p>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant={urgencyBadge.variant} className={urgencyBadge.className}>
                                          {urgencyBadge.label}
                                        </Badge>
                                        {leadSignals.map((signal) => (
                                          <Badge key={`${lead.id}-${signal.label}`} variant={signal.variant} className={signal.className}>
                                            {signal.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <InlineStatusSelect
                                      value={lead.status}
                                      disabled={pendingLeadId === lead.id}
                                      onChange={(value) => handleLeadStatusChange(lead.id, value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <InlinePrioritySelect
                                      value={lead.priority}
                                      disabled={pendingLeadId === lead.id}
                                      onChange={(value) => handleInlineLeadUpdate(lead.id, { priority: value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <InlineResponsibleSelect
                                      value={lead.responsible_profile_id}
                                      profiles={profiles}
                                      disabled={pendingLeadId === lead.id}
                                      onChange={(value) => handleInlineLeadUpdate(lead.id, { responsible_profile_id: value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground">{lead.tentative_event_date ? formatDate(lead.tentative_event_date, true) : 'Sin definir'}</p>
                                      {tentativeDateTone ? <Badge variant={tentativeDateTone.variant}>{tentativeDateTone.label}</Badge> : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                                      <InlineFollowUpInput
                                        value={lead.follow_up_at}
                                        disabled={pendingLeadId === lead.id}
                                        onSave={(value) => handleInlineLeadUpdate(lead.id, { follow_up_at: value })}
                                      />
                                      <Badge variant={followUpTone.variant}>{followUpTone.label}</Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <InlineNextActionInput
                                      value={lead.next_action}
                                      disabled={pendingLeadId === lead.id}
                                      onSave={(value) => handleInlineLeadUpdate(lead.id, { next_action: value })}
                                    />
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{lead.source_platform ?? 'Sin definir'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{getServiceInterestLabel(lead)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{lead.guest_count?.toString() ?? '—'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{formatDate(lead.last_interaction_at)}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-2 opacity-80 transition group-hover/row:opacity-100">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedLeadId(lead.id);
                                        }}
                                      >
                                        <Eye className="size-4" />
                                        Abrir
                                      </Button>
                                      <Button asChild variant="outline" size="sm" className="hidden group-hover/row:inline-flex" onClick={(event) => event.stopPropagation()}>
                                        <Link href={editHref}>
                                          <PencilLine className="size-4" />
                                          Editar
                                        </Link>
                                      </Button>
                                      <Button asChild variant="ghost" size="sm" className="hidden group-hover/row:inline-flex" onClick={(event) => event.stopPropagation()}>
                                        <Link href={detailHref}>
                                          Ir a detalle
                                          <ArrowRight className="size-4" />
                                        </Link>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="grid gap-4 p-4 xl:hidden">
                        {group.items.map((lead) => {
                          const detailHref = `/leads/${lead.id}` as Route;
                          const editHref = `/leads/${lead.id}/editar` as Route;
                          const intelligence = intelligenceByLeadId[lead.id] ?? getLeadIntelligence(lead);
                          const followUpTone = intelligence.followUpTone;
                          const urgencyBadge = intelligence.urgencyBadge;
                          const scoreBreakdown = intelligence.scoreBreakdown;

                          return (
                            <Card key={lead.id} className={cn('border border-border/80 shadow-none', selectedLeadIds.includes(lead.id) && 'bg-primary/5')}>
                              <CardContent className="space-y-4 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <button type="button" className="text-left text-base font-semibold text-foreground" onClick={() => setSelectedLeadId(lead.id)}>
                                      {lead.full_name}
                                    </button>
                                    <p className="text-sm text-muted-foreground">{getPrimaryContact(lead)}</p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <Badge variant={scoreBreakdown.score >= 75 ? 'success' : scoreBreakdown.score >= 50 ? 'secondary' : 'outline'}>
                                        Score {scoreBreakdown.score}
                                      </Badge>
                                      <Badge variant={urgencyBadge.variant} className={urgencyBadge.className}>
                                        {urgencyBadge.label}
                                      </Badge>
                                      {intelligence.signals.map((signal) => (
                                        <Badge key={`${lead.id}-mobile-${signal.label}`} variant={signal.variant} className={signal.className}>
                                          {signal.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <InlinePrioritySelect
                                    value={lead.priority}
                                    disabled={pendingLeadId === lead.id}
                                    onChange={(value) => handleInlineLeadUpdate(lead.id, { priority: value })}
                                  />
                                </div>

                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={selectedLeadIds.includes(lead.id)}
                                    onChange={() => toggleLeadSelection(lead.id)}
                                  />
                                  Seleccionar para acciones rápidas
                                </label>

                                <InlineStatusSelect
                                  value={lead.status}
                                  disabled={pendingLeadId === lead.id}
                                  onChange={(value) => handleLeadStatusChange(lead.id, value)}
                                />

                                <div className="grid gap-3 rounded-2xl bg-muted/25 p-4 text-sm">
                                  <InfoLine
                                    label="Responsable"
                                    value={
                                      <InlineResponsibleSelect
                                        value={lead.responsible_profile_id}
                                        profiles={profiles}
                                        disabled={pendingLeadId === lead.id}
                                        onChange={(value) => handleInlineLeadUpdate(lead.id, { responsible_profile_id: value })}
                                      />
                                    }
                                  />
                                  <InfoLine
                                    label="Seguimiento"
                                    value={
                                      <InlineFollowUpInput
                                        value={lead.follow_up_at}
                                        disabled={pendingLeadId === lead.id}
                                        onSave={(value) => handleInlineLeadUpdate(lead.id, { follow_up_at: value })}
                                      />
                                    }
                                    badge={<Badge variant={followUpTone.variant}>{followUpTone.label}</Badge>}
                                  />
                                  <InfoLine
                                    label="Próxima acción"
                                    value={<InlineNextActionInput value={lead.next_action} disabled={pendingLeadId === lead.id} onSave={(value) => handleInlineLeadUpdate(lead.id, { next_action: value })} />}
                                  />
                                  <InfoLine label="Origen" value={lead.source_platform ?? 'Sin definir'} />
                                  <InfoLine label="Servicio" value={getServiceInterestLabel(lead)} />
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <Button type="button" className="sm:flex-1" onClick={() => setSelectedLeadId(lead.id)}>
                                    <Eye className="size-4" />
                                    Abrir lead
                                  </Button>
                                  <Button asChild variant="outline" className="sm:flex-1">
                                    <Link href={editHref}>
                                      <PencilLine className="size-4" />
                                      Editar
                                    </Link>
                                  </Button>
                                  <Button asChild variant="ghost" className="sm:flex-1">
                                    <Link href={detailHref}>Detalle</Link>
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
        </div>
      )}

      <LeadQuickViewDrawer
        lead={selectedLead}
        profiles={profiles}
        suggestionFeedback={suggestionFeedback}
        onFeedback={(suggestionId, type) => {
          trackSuggestionFeedback(suggestionId, type);
          setInteractionFeedback(type === 'notUseful' ? 'Gracias, ajustaremos esta sugerencia.' : 'Feedback registrado.');
        }}
        activeTab={activeDrawerTab}
        onTabChange={setActiveDrawerTab}
        onClose={() => {
          setSelectedLeadId(null);
          setActiveDrawerTab('overview');
        }}
      />
      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        title="Acciones rápidas · Leads"
        items={commandItems}
      />
    </ModulePageLayout>
  );
}

function SelectControl({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <select
        className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm font-medium tracking-normal text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineStatusSelect({ value, disabled, onChange }: { value: LeadStatus; disabled?: boolean; onChange: (value: LeadStatus) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <select
        className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as LeadStatus)}
      >
        {leadStatusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlinePrioritySelect({ value, disabled, onChange }: { value: LeadPriority; disabled?: boolean; onChange: (value: LeadPriority) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <select
        className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as LeadPriority)}
      >
        {leadPriorityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlineResponsibleSelect({
  value,
  profiles,
  disabled,
  onChange,
}: {
  value: string | null;
  profiles: Record<string, LeadProfileOption>;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const orderedProfiles = Object.values(profiles).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'es'));

  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-2" onClick={(event) => event.stopPropagation()}>
      <select
        className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Sin asignar</option>
        {orderedProfiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.full_name ?? profile.id}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlineFollowUpInput({ value, disabled, onSave }: { value: string | null; disabled?: boolean; onSave: (value: string | null) => Promise<void> | void }) {
  const [draftValue, setDraftValue] = useState(() => toDateTimeLocalValue(value));

  useEffect(() => {
    setDraftValue(toDateTimeLocalValue(value));
  }, [value]);

  async function commit() {
    const normalized = normalizeInlineDate(draftValue);
    const currentTime = value ? new Date(value).getTime() : null;
    const nextTime = normalized ? new Date(normalized).getTime() : null;
    if (currentTime === nextTime) return;
    await onSave(normalized);
  }

  return (
    <Input
      type="datetime-local"
      value={draftValue}
      disabled={disabled}
      className="h-10 bg-background"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraftValue(event.target.value)}
      onBlur={() => void commit()}
    />
  );
}

function InlineNextActionInput({ value, disabled, onSave }: { value: string; disabled?: boolean; onSave: (value: string) => Promise<void> | void }) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  async function commit() {
    const normalized = draftValue.trim();
    if (!normalized || normalized === value) {
      setDraftValue(value);
      return;
    }

    await onSave(normalized);
  }

  return (
    <Input
      value={draftValue}
      disabled={disabled}
      className="h-10 bg-background text-sm"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraftValue(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void commit();
        }
      }}
    />
  );
}

function InfoLine({ label, value, badge }: { label: string; value: ReactNode; badge?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
        {badge}
      </div>
      {typeof value === 'string' ? <p className="text-sm text-foreground">{value}</p> : value}
    </div>
  );
}

function LeadQuickViewDrawer({
  lead,
  profiles,
  suggestionFeedback,
  onFeedback,
  activeTab,
  onTabChange,
  onClose,
}: {
  lead: LeadRecord | null;
  profiles: Record<string, LeadProfileOption>;
  suggestionFeedback: Record<string, { applied: number; useful: number; notUseful: number }>;
  onFeedback: (suggestionId: string, type: 'useful' | 'notUseful') => void;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onClose: () => void;
}) {
  if (!lead) return null;

  const detailHref = `/leads/${lead.id}` as Route;
  const editHref = `/leads/${lead.id}/editar` as Route;
  const intelligence = getLeadIntelligence(lead);
  const followUpTone = intelligence.followUpTone;
  const suggestion = intelligence.actionSuggestion;
  const scoreBreakdown = intelligence.scoreBreakdown;
  const suggestionStats = suggestionFeedback[suggestion.id] ?? { applied: 0, useful: 0, notUseful: 0 };
  const activityTimeline = [
    { label: 'Creado', value: formatDate(lead.created_at), tone: 'default' },
    { label: 'Última interacción', value: formatDate(lead.last_interaction_at), tone: 'default' },
    { label: 'Seguimiento', value: lead.follow_up_at ? formatDate(lead.follow_up_at) : 'Sin seguimiento programado', tone: followUpTone.label === 'Vencido' ? 'warning' : 'default' },
    { label: 'Última actualización', value: formatDate(lead.updated_at), tone: 'default' },
  ] as const;
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Resumen contextual</CardTitle>
            <CardDescription>Vista rápida del lead sin abandonar el board principal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Siguiente acción sugerida</p>
              <p className="mt-2 text-sm font-medium text-foreground">{suggestion.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={suggestion.urgency === 'critical' || suggestion.urgency === 'high' ? 'warning' : suggestion.urgency === 'medium' ? 'secondary' : 'outline'}>
                  Urgencia: {suggestion.urgency}
                </Badge>
                <Badge variant={scoreBreakdown.score >= 75 ? 'success' : scoreBreakdown.score >= 50 ? 'secondary' : 'outline'}>Lead score: {scoreBreakdown.score}</Badge>
                {suggestion.suggestedStatus ? <Badge variant="outline">Estado sugerido: {suggestion.suggestedStatus}</Badge> : null}
              </div>
              <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">¿Por qué esta sugerencia?</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {suggestion.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onFeedback(suggestion.id, 'useful')}>
                    Útil
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onFeedback(suggestion.id, 'notUseful')}>
                    No útil
                  </Button>
                  <Badge variant="outline">Aplicada {suggestionStats.applied}</Badge>
                  <Badge variant="outline">Útil {suggestionStats.useful}</Badge>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
            <QuickStat label="Responsable" value={getResponsibleLabel(lead, profiles)} />
            <QuickStat label="Origen" value={lead.source_platform ?? 'Sin definir'} />
            <QuickStat label="Servicio" value={getServiceInterestLabel(lead)} />
            <QuickStat label="Invitados" value={lead.guest_count?.toString() ?? 'Sin definir'} />
            <QuickStat label="Fecha tentativa" value={lead.tentative_event_date ? formatDate(lead.tentative_event_date, true) : 'Sin definir'} />
            <QuickStat label="Última interacción" value={formatDate(lead.last_interaction_at)} />
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'activity',
      label: 'Actividad',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Seguimiento operativo</CardTitle>
            <CardDescription>Visibilidad rápida de pendientes, próximo paso y señales de riesgo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-muted/25 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Próxima acción</p>
              <p className="mt-2 text-sm text-foreground">{lead.next_action}</p>
            </div>
            <div className="rounded-2xl bg-muted/25 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Seguimiento</p>
                <Badge variant={followUpTone.variant}>{followUpTone.label}</Badge>
              </div>
              <p className="mt-2 text-sm text-foreground">{lead.follow_up_at ? formatDate(lead.follow_up_at) : 'Sin seguimiento programado'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Timeline</p>
              <div className="mt-3 space-y-3">
                {activityTimeline.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className={cn('mt-1 size-2 rounded-full', item.tone === 'warning' ? 'bg-amber-500' : 'bg-primary')} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Factores del score</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {scoreBreakdown.factors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'notes',
      label: 'Notas',
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Notas internas</CardTitle>
            <CardDescription>Contexto rápido para continuar el trabajo sin saltar de vista.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{lead.internal_notes ?? 'Aún no hay notas registradas en este lead.'}</p>
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <DetailDrawer
      open={Boolean(lead)}
      onClose={onClose}
      badge={(
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Quick view</Badge>
          <LeadStatusBadge status={lead.status} />
          <LeadPriorityBadge priority={lead.priority} />
        </div>
      )}
      title={lead.full_name}
      subtitle={getPrimaryContact(lead)}
      tabs={tabs}
      activeTab={activeTab}
      onChangeTab={onTabChange}
      headerActions={(
        <>
          <Button asChild>
            <Link href={editHref}>
              <PencilLine className="size-4" />
              Editar lead
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={detailHref}>
              Ver detalle completo
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      )}
    />
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-background p-4')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
