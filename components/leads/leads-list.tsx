'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { leadPriorityOptions, leadStatusOptions } from '@/config/leads';
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
const FILTERS_STORAGE_KEY = 'manna.leads.filters.collapsed';

function formatDate(value: string | null, dateOnly = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', dateOnly ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getPrimaryContact(lead: LeadRecord) {
  return lead.email ?? lead.phone ?? 'Sin contacto principal';
}

function getResponsibleLabel(lead: LeadRecord, profiles: Record<string, LeadProfileOption>) {
  if (!lead.responsible_profile_id) return 'Sin asignar';
  return profiles[lead.responsible_profile_id]?.full_name ?? 'Responsable asignado';
}

function getFollowUpTone(value: string | null) {
  if (!value) return { label: 'Sin seguimiento', variant: 'outline' as const };

  const diff = new Date(value).getTime() - Date.now();
  if (diff < 0) return { label: 'Vencido', variant: 'warning' as const };
  if (diff <= 1000 * 60 * 60 * 24) return { label: 'Hoy', variant: 'warning' as const };
  if (diff <= 1000 * 60 * 60 * 24 * 3) return { label: 'Próximo', variant: 'secondary' as const };
  return { label: 'Programado', variant: 'outline' as const };
}

function getTentativeDateTone(value: string | null) {
  if (!value) return null;

  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) return null;

  const diff = eventDate.getTime() - Date.now();
  if (diff < 0) return null;
  if (diff <= 1000 * 60 * 60 * 24 * 7) {
    return { label: 'Evento cercano', variant: 'secondary' as const };
  }

  return null;
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

function getLeadSignals(lead: LeadRecord) {
  const followUpTone = getFollowUpTone(lead.follow_up_at);
  const tentativeDateTone = getTentativeDateTone(lead.tentative_event_date);
  const signals: Array<{ label: string; variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning'; className?: string }> = [];

  if (lead.priority === 'urgente') {
    signals.push({ label: 'Urgente', variant: 'warning', className: 'bg-rose-100 text-rose-700' });
  }

  if (followUpTone.label === 'Vencido') {
    signals.push({ label: 'Seguimiento vencido', variant: 'warning' });
  } else if (followUpTone.label === 'Hoy') {
    signals.push({ label: 'Seguimiento hoy', variant: 'warning' });
  } else if (!lead.follow_up_at && !['ganado', 'perdido'].includes(lead.status)) {
    signals.push({ label: 'Sin seguimiento', variant: 'outline' });
  }

  if (tentativeDateTone) {
    signals.push({ label: tentativeDateTone.label, variant: tentativeDateTone.variant });
  }

  return signals;
}

function matchesSearch(lead: LeadRecord, term: string) {
  const haystack = [
    lead.full_name,
    lead.email,
    lead.phone,
    lead.next_action,
    lead.source_platform,
    lead.service_interest,
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
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  useEffect(() => {
    setBoardLeads(leads);
  }, [leads]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (storedValue === 'true') {
      setFiltersCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, String(filtersCollapsed));
  }, [filtersCollapsed]);

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

  const groupedLeads = useMemo(
    () =>
      leadStatusOptions.map((option) => {
        const items = filteredAndSortedLeads.filter((lead) => lead.status === option.value);
        const overdueCount = items.filter((lead) => getFollowUpTone(lead.follow_up_at).label === 'Vencido').length;
        return {
          status: option.value,
          label: option.label,
          items,
          overdueCount,
        };
      }),
    [filteredAndSortedLeads],
  );

  const visibleLeadCount = groupedLeads.reduce((accumulator, group) => accumulator + group.items.length, 0);
  const selectedLead = filteredAndSortedLeads.find((lead) => lead.id === selectedLeadId) ?? boardLeads.find((lead) => lead.id === selectedLeadId) ?? null;
  const hasActiveFilters = search || statusFilter !== 'all' || priorityFilter !== 'all' || responsibleFilter !== 'all' || sortMode !== 'follow_up';

  function toggleGroup(status: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [status]: !current[status],
    }));
  }

  function resetBoardControls() {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setResponsibleFilter('all');
    setSortMode('follow_up');
  }

  function applyLocalLeadPatch(leadId: string, patch: Partial<LeadRecord>) {
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
  }

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
      router.refresh();
    }

    setPendingLeadId(null);
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-5 text-white shadow-panel sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Leads</Badge>
              <Badge className="bg-white/10 text-white">Board operativo</Badge>
              <Badge className="bg-white/10 text-white">Vista principal: Tabla</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold sm:text-4xl">Board de Leads para seguimiento diario</h1>
              <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
                Mantengo el enfoque tipo board, pero concentrado en una tabla agrupada realmente operativa, con más espacio útil y navegación clara.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[420px]">
            {viewCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {statusUpdateError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">{statusUpdateError}</CardContent>
        </Card>
      ) : null}

      <Card className="sticky top-4 z-20 border-border/80 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm">
                <TableProperties className="size-4" />
                Tabla
              </Button>
              <Badge variant="outline">Kanban no implementado</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.4fr_auto] xl:items-center">
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{visibleLeadCount} leads visibles</Badge>
              <Badge variant="outline">Agrupado por estado</Badge>
              {hasActiveFilters ? <Badge variant="outline">Filtros activos</Badge> : null}
            </div>
          </div>

          {!filtersCollapsed ? (
            <div className="grid gap-3 border-t border-border/70 pt-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      {visibleLeadCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <p className="text-lg font-semibold">No hay leads que coincidan con la búsqueda actual.</p>
            <p className="text-sm text-muted-foreground">Ajusta filtros, limpia la búsqueda o crea un nuevo lead para seguir operando desde el board.</p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={resetBoardControls}>
                Limpiar filtros
              </Button>
              <Button asChild>
                <Link href="/leads/nuevo">Nuevo lead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
                              <TableHead className="min-w-[220px]">Nombre</TableHead>
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
                              const followUpTone = getFollowUpTone(lead.follow_up_at);
                              const tentativeDateTone = getTentativeDateTone(lead.tentative_event_date);
                              const leadSignals = getLeadSignals(lead);

                              return (
                                <TableRow
                                  key={lead.id}
                                  className={cn(
                                    'cursor-pointer align-top',
                                    followUpTone.label === 'Vencido' && 'bg-amber-50/60',
                                    lead.priority === 'urgente' && 'border-l-2 border-l-rose-300',
                                  )}
                                  onClick={() => setSelectedLeadId(lead.id)}
                                >
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
                                  <TableCell className="text-sm text-muted-foreground">{lead.service_interest ?? 'Sin definir'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{lead.guest_count?.toString() ?? '—'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{formatDate(lead.last_interaction_at)}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-2">
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
                                      <Button asChild variant="outline" size="sm" onClick={(event) => event.stopPropagation()}>
                                        <Link href={editHref}>
                                          <PencilLine className="size-4" />
                                          Editar
                                        </Link>
                                      </Button>
                                      <Button asChild variant="ghost" size="sm" onClick={(event) => event.stopPropagation()}>
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
                          const followUpTone = getFollowUpTone(lead.follow_up_at);

                          return (
                            <Card key={lead.id} className="border border-border/80 shadow-none">
                              <CardContent className="space-y-4 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <button type="button" className="text-left text-base font-semibold text-foreground" onClick={() => setSelectedLeadId(lead.id)}>
                                      {lead.full_name}
                                    </button>
                                    <p className="text-sm text-muted-foreground">{getPrimaryContact(lead)}</p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {getLeadSignals(lead).map((signal) => (
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
                                  <InfoLine label="Servicio" value={lead.service_interest ?? 'Sin definir'} />
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

      <LeadQuickViewDrawer lead={selectedLead} profiles={profiles} onClose={() => setSelectedLeadId(null)} />
    </div>
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
  onClose,
}: {
  lead: LeadRecord | null;
  profiles: Record<string, LeadProfileOption>;
  onClose: () => void;
}) {
  if (!lead) return null;

  const detailHref = `/leads/${lead.id}` as Route;
  const editHref = `/leads/${lead.id}/editar` as Route;
  const followUpTone = getFollowUpTone(lead.follow_up_at);

  return (
    <>
      <button type="button" aria-label="Cerrar panel" className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Quick view</Badge>
                <LeadStatusBadge status={lead.status} />
                <LeadPriorityBadge priority={lead.priority} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{lead.full_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{getPrimaryContact(lead)}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <Card>
            <CardHeader>
              <CardTitle>Resumen contextual</CardTitle>
              <CardDescription>Vista rápida del lead sin abandonar el board principal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <QuickStat label="Responsable" value={getResponsibleLabel(lead, profiles)} />
              <QuickStat label="Origen" value={lead.source_platform ?? 'Sin definir'} />
              <QuickStat label="Servicio" value={lead.service_interest ?? 'Sin definir'} />
              <QuickStat label="Invitados" value={lead.guest_count?.toString() ?? 'Sin definir'} />
              <QuickStat label="Fecha tentativa" value={lead.tentative_event_date ? formatDate(lead.tentative_event_date, true) : 'Sin definir'} />
              <QuickStat label="Última interacción" value={formatDate(lead.last_interaction_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seguimiento operativo</CardTitle>
              <CardDescription>Base lista para evolucionar a updates internas del item.</CardDescription>
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
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Actualizaciones internas · Próximamente</p>
                <p className="mt-2">Esta zona queda preparada para futuras updates del item, notas colaborativas, menciones e historial más conversacional.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
              <CardDescription>Abre edición o detalle completo cuando necesites más contexto.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
              <Button asChild variant="outline">
                <Link href="/leads/nuevo">
                  <Plus className="size-4" />
                  Nuevo lead
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </aside>
    </>
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
