import type { Route } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Clock3, Mail, MapPin, PencilLine, Phone, Plus, UserRound } from 'lucide-react';

import { LeadPriorityBadge, LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { LeadQuotesPanel } from '@/components/quotes/lead-quotes-panel';
import { RecordTimelineSection } from '@/components/communication/record-timeline-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { leadPriorityLabels, leadStatusLabels } from '@/config/leads';
import { buildServiceInterestSummary, parseServiceInterests } from '@/lib/leads/service-interest';
import type { ClientRecord } from '@/types/clients';
import type { LeadActivityRecord, LeadProfileOption, LeadRecord } from '@/types/leads';
import type { QuoteRecord } from '@/types/quotes';

interface LeadDetailProps {
  lead: LeadRecord;
  activities: LeadActivityRecord[];
  profiles: Record<string, LeadProfileOption>;
  quotes: QuoteRecord[];
  client: ClientRecord | null;
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function LeadDetail({ lead, activities, profiles, quotes, client }: LeadDetailProps) {
  const serviceInterestSummary =
    buildServiceInterestSummary(
      parseServiceInterests({
        serviceInterests: lead.service_interests,
        serviceInterest: lead.service_interest,
      }),
    ) || 'Sin definir';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <LeadStatusBadge status={lead.status} />
          <LeadPriorityBadge priority={lead.priority} />
        </div>
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-semibold">{lead.full_name}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Responsable actual: {lead.responsible_profile_id ? profiles[lead.responsible_profile_id]?.full_name ?? 'Asignado' : 'Sin asignar'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Próxima acción</p>
            <p className="mt-2">{lead.next_action}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/leads/${lead.id}/editar` as Route}>
              <PencilLine className="size-4" />
              Editar lead
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`/leads/${lead.id}/cotizaciones/nueva` as Route}>
              <Plus className="size-4" />
              Nueva cotización
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href="/leads">Volver al board</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href="/leads/nuevo">
              <Plus className="size-4" />
              Nuevo lead
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del item</CardTitle>
              <CardDescription>Este detalle conserva contexto del board y organiza el lead como unidad operativa.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoItem icon={<Phone className="size-4" />} label="Teléfono" value={lead.phone ?? 'No capturado'} />
              <InfoItem icon={<Mail className="size-4" />} label="Email" value={lead.email ?? 'No capturado'} />
              <InfoItem icon={<MapPin className="size-4" />} label="Ciudad o dirección" value={lead.location ?? 'Sin definir'} />
              <InfoItem icon={<Clock3 className="size-4" />} label="Seguimiento" value={formatDate(lead.follow_up_at)} />
              <InfoItem label="Idioma" value={lead.language === 'en' ? 'Inglés' : 'Español'} />
              <InfoItem label="Plataforma de origen" value={lead.source_platform ?? 'Sin definir'} />
              <InfoItem label="Tipo de evento" value={lead.event_type ?? 'Sin definir'} />
              <InfoItem label="Servicio de interés" value={serviceInterestSummary} />
              <InfoItem label="Fecha tentativa" value={lead.tentative_event_date ?? 'Sin definir'} />
              <InfoItem label="Hora tentativa" value={lead.tentative_event_time ?? 'Sin definir'} />
              <InfoItem label="Invitados" value={lead.guest_count?.toString() ?? 'Sin definir'} />
              <InfoItem label="Total cotizado" value={lead.quoted_total ? `$${Number(lead.quoted_total).toFixed(2)}` : 'Sin cotización'} />
              <InfoItem label="Promoción ofrecida" value={lead.promotion_offered ?? 'Sin promoción'} />
              <InfoItem label="Última interacción" value={formatDate(lead.last_interaction_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seguimiento y notas</CardTitle>
              <CardDescription>Bloque operativo pensado para convivir con una futura sección de updates del item.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Próxima acción</p>
                <p className="mt-2 text-sm text-foreground">{lead.next_action}</p>
              </div>
              <div className="rounded-2xl bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Notas internas</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{lead.internal_notes ?? 'Aún no hay notas internas registradas.'}</p>
              </div>
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Actualizaciones internas · Próximamente</p>
                <p className="mt-2">Queda preparada una zona para updates, notas colaborativas y menciones futuras sin romper el detalle actual.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resultado comercial</CardTitle>
              <CardDescription>Visibilidad rápida del avance entre lead, cotización y cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Estado del lead" value={leadStatusLabels[lead.status]} />
              <SummaryRow label="Cotizaciones ligadas" value={quotes.length.toString()} />
              <SummaryRow label="Cliente creado" value={client ? 'Sí, conversión completada' : 'Aún no'} />
              {client ? (
                <Button asChild size="sm">
                  <Link href={`/clientes/${client.id}` as Route}>Abrir cliente</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <LeadQuotesPanel leadId={lead.id} quotes={quotes} />

          <Card>
            <CardHeader>
              <CardTitle>Contexto del lead</CardTitle>
              <CardDescription>Información breve y accionable para trabajo diario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <SummaryRow label="Estado" value={leadStatusLabels[lead.status]} />
              <SummaryRow label="Prioridad" value={leadPriorityLabels[lead.priority]} />
              <SummaryRow label="Responsable" value={lead.responsible_profile_id ? profiles[lead.responsible_profile_id]?.full_name ?? 'Asignado' : 'Sin asignar'} />
              <SummaryRow label="Creado por" value={profiles[lead.created_by]?.full_name ?? 'Usuario interno'} />
              <SummaryRow label="Última edición" value={profiles[lead.updated_by]?.full_name ?? 'Usuario interno'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad del item</CardTitle>
              <CardDescription>Historial base del lead, listo para crecer a updates más ricas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay actividad registrada para este lead.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="rounded-2xl bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{activity.summary}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{activity.details ?? 'Sin detalle adicional.'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Registrado por {activity.created_by ? profiles[activity.created_by]?.full_name ?? 'Usuario interno' : 'Sistema'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <RecordTimelineSection entityType="lead" entityId={lead.id} returnPath={`/leads/${lead.id}`} />
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
      <span>{label}</span>
      <span className="inline-flex items-center gap-2 font-medium text-foreground">
        <UserRound className="size-4 text-primary" />
        {value}
      </span>
    </div>
  );
}
