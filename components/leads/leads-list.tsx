import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Plus, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LeadPriorityBadge, LeadStatusBadge } from '@/components/leads/lead-status-badge';
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
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function LeadsList({ leads, summary, profiles }: LeadsListProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Leads</Badge>
          <Badge className="bg-white/10 text-white">Módulo funcional inicial</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Oportunidades con seguimiento real</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Esta base ya permite registrar leads, priorizarlos, asignar responsable y dejar trazabilidad suficiente para no perder prospectos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/leads/nuevo">
              <Plus className="size-4" />
              Nuevo lead
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total de leads', value: summary.total.toString() },
          { label: 'Pendientes', value: summary.pendientes.toString() },
          { label: 'Seguimiento por vencer', value: summary.seguimientoHoy.toString() },
          { label: 'Alta prioridad', value: summary.altaPrioridad.toString() },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl">{item.value}</CardTitle>
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
                Crea el primer lead para comenzar a centralizar prospectos, siguiente acción, prioridad y responsable dentro de Manna Snack Bars.
              </p>
            </div>
            <Button asChild>
              <Link href="/leads/nuevo">Crear primer lead</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Listado de leads</CardTitle>
            <CardDescription>Vista base para operar seguimiento comercial desde un solo lugar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Próxima acción</TableHead>
                  <TableHead>Seguimiento</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const detailHref = `/leads/${lead.id}` as Route;
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{lead.full_name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email ?? lead.phone ?? 'Sin contacto principal'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell>
                        <LeadPriorityBadge priority={lead.priority} />
                      </TableCell>
                      <TableCell className="max-w-[240px] text-muted-foreground">{lead.next_action}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(lead.follow_up_at)}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                          <UserRound className="size-3.5" />
                          {lead.responsible_profile_id ? profiles[lead.responsible_profile_id]?.full_name ?? 'Responsable asignado' : 'Sin asignar'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={detailHref}>
                            Ver detalle
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
