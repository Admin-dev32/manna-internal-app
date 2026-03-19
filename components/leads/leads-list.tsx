import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Clock3, PencilLine, Plus, Sparkles, UserRound } from 'lucide-react';

import { LeadPriorityBadge, LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';

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

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha programada';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getPrimaryContact(lead: LeadRecord) {
  return lead.email ?? lead.phone ?? 'Sin contacto principal';
}

function getResponsibleLabel(lead: LeadRecord, profiles: Record<string, LeadProfileOption>) {
  if (!lead.responsible_profile_id) return 'Sin asignar';
  return profiles[lead.responsible_profile_id]?.full_name ?? 'Responsable asignado';
}

function isActionDueSoon(value: string | null) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now() + 1000 * 60 * 60 * 24;
}

export function LeadsList({ leads, summary, profiles }: LeadsListProps) {
  const overviewItems = [
    {
      label: 'Total de leads',
      value: summary.total.toString(),
      description: 'Prospectos capturados para seguimiento comercial.',
    },
    {
      label: 'Pendientes',
      value: summary.pendientes.toString(),
      description: 'Oportunidades aún abiertas que requieren movimiento.',
    },
    {
      label: 'Seguimiento por vencer',
      value: summary.seguimientoHoy.toString(),
      description: 'Leads con siguiente contacto programado o por resolver.',
    },
    {
      label: 'Alta prioridad',
      value: summary.altaPrioridad.toString(),
      description: 'Casos que conviene atender primero en la operación diaria.',
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <section className="flex flex-col gap-5 rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Leads</Badge>
          <Badge className="bg-white/10 text-white">Operación comercial diaria</Badge>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Gestión de leads con acceso rápido a crear, revisar y actualizar</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            La vista principal ahora prioriza el seguimiento, hace más visible el acceso a crear leads y deja acciones rápidas para abrir detalle o editar sin depender de URLs manuales.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/leads/nuevo">
              <Plus className="size-4" />
              Nuevo lead
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href="#leads-listado">
              <Sparkles className="size-4" />
              Ir al listado
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewItems.map((item) => (
          <Card key={item.label} className="border-border/80">
            <CardHeader className="gap-3">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-3xl">{item.value}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardHeader>
          </Card>
        ))}
      </section>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-5 p-6 sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarClock className="size-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Todavía no hay leads registrados</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Crea el primer lead para empezar a centralizar contacto, prioridad, siguiente acción y responsable dentro de Manna Snack Bars.
              </p>
            </div>
            <Button asChild>
              <Link href="/leads/nuevo">Crear primer lead</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card id="leads-listado" className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 border-b border-border/70 bg-muted/20 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Listado operativo de leads</CardTitle>
              <CardDescription>Información clave visible, acciones rápidas y mejor lectura tanto en desktop como en mobile.</CardDescription>
            </div>
            <Button asChild>
              <Link href="/leads/nuevo">
                <Plus className="size-4" />
                Nuevo lead
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-4 md:hidden">
              {leads.map((lead) => {
                const detailHref = `/leads/${lead.id}` as Route;
                const editHref = `/leads/${lead.id}/editar` as Route;
                const dueSoon = isActionDueSoon(lead.follow_up_at);

                return (
                  <Card key={lead.id} className="border border-border/80 shadow-none">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">{lead.full_name}</p>
                          <p className="text-sm text-muted-foreground">{getPrimaryContact(lead)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <LeadStatusBadge status={lead.status} />
                          <LeadPriorityBadge priority={lead.priority} />
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-2xl bg-muted/30 p-4 text-sm">
                        <InfoLine label="Próxima acción" value={lead.next_action} />
                        <InfoLine label="Seguimiento" value={formatDate(lead.follow_up_at)} icon={<Clock3 className="size-4 text-primary" />} />
                        <InfoLine label="Responsable" value={getResponsibleLabel(lead, profiles)} icon={<UserRound className="size-4 text-primary" />} />
                        {lead.source_platform ? <InfoLine label="Origen" value={lead.source_platform} /> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {dueSoon ? <Badge variant="warning">Atención hoy</Badge> : null}
                        {!lead.follow_up_at ? <Badge variant="outline">Sin seguimiento programado</Badge> : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button asChild className="sm:flex-1">
                          <Link href={detailHref}>
                            Ver detalle
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="sm:flex-1">
                          <Link href={editHref}>
                            <PencilLine className="size-4" />
                            Editar
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Próxima acción</TableHead>
                    <TableHead>Seguimiento</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="w-[180px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => {
                    const detailHref = `/leads/${lead.id}` as Route;
                    const editHref = `/leads/${lead.id}/editar` as Route;
                    const dueSoon = isActionDueSoon(lead.follow_up_at);

                    return (
                      <TableRow key={lead.id} className="align-top">
                        <TableCell>
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground">{lead.full_name}</p>
                              <p className="text-xs text-muted-foreground">{getPrimaryContact(lead)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {lead.source_platform ? <Badge variant="outline">Origen: {lead.source_platform}</Badge> : null}
                              {!lead.follow_up_at ? <Badge variant="outline">Sin seguimiento</Badge> : null}
                              {dueSoon ? <Badge variant="warning">Atención hoy</Badge> : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <LeadStatusBadge status={lead.status} />
                        </TableCell>
                        <TableCell>
                          <LeadPriorityBadge priority={lead.priority} />
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <p className="line-clamp-3 text-sm text-foreground">{lead.next_action}</p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>{formatDate(lead.follow_up_at)}</p>
                            {lead.tentative_event_date ? <p className="text-xs">Evento tentativo: {lead.tentative_event_date}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                            <UserRound className="size-3.5" />
                            {getResponsibleLabel(lead, profiles)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Button asChild size="sm">
                              <Link href={detailHref}>
                                Ver detalle
                                <ArrowRight className="size-4" />
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <Link href={editHref}>
                                <PencilLine className="size-4" />
                                Editar
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
          </CardContent>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-4 z-20 px-4 md:hidden">
        <Button asChild size="lg" className="w-full shadow-lg">
          <Link href="/leads/nuevo">
            <Plus className="size-4" />
            Nuevo lead
          </Link>
        </Button>
      </div>
    </div>
  );
}

function InfoLine({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{label}</p>
      <div className="flex items-start gap-2 text-sm text-foreground">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
