import Link from 'next/link';
import type { Route } from 'next';
import { MessageSquareText, Sparkles, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunicationHubEntry, CommunicationHubFilters } from '@/services/internal-communication/queries';
import { INTERNAL_COMMENT_ENTITY_TYPES, type InternalCommentEntityType } from '@/types/internal-communication';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const moduleLabels: Record<InternalCommentEntityType, string> = {
  lead: 'Leads',
  quote: 'Cotizaciones',
  client: 'Clientes',
  pre_event: 'Reservas',
  event: 'Eventos',
  event_task: 'Tareas',
};

const moduleFilterOptions: Array<{ value: CommunicationHubFilters['module']; label: string }> = [
  { value: 'all', label: 'Todos los módulos' },
  ...INTERNAL_COMMENT_ENTITY_TYPES.map((module) => ({ value: module, label: moduleLabels[module] })),
];

const channelFilterOptions: Array<{ value: CommunicationHubFilters['channel']; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'mentions', label: 'Solo menciones' },
];

const timeframeFilterOptions: Array<{ value: CommunicationHubFilters['timeframe']; label: string }> = [
  { value: 'all', label: 'Histórico reciente' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 días' },
];

function buildFilterHref(filters: CommunicationHubFilters): Route {
  const params = new URLSearchParams();
  params.set('channel', filters.channel);
  params.set('module', filters.module);
  params.set('timeframe', filters.timeframe);
  return `/comunicacion?${params.toString()}` as Route;
}

export function CommunicationHub({
  entries,
  filters,
}: {
  entries: CommunicationHubEntry[];
  filters: CommunicationHubFilters;
}) {
  const mentionsCount = entries.reduce((accumulator, entry) => accumulator + entry.mentionCount, 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Comunicación interna</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">{entries.length} comentarios visibles</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Centro de comunicación</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Vista unificada de comentarios internos por registro. Incluye actividad con @menciones y acceso directo al origen.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Refina la actividad por tipo de comunicación, módulo o recencia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterRow
                label="Canal"
                options={channelFilterOptions}
                currentValue={filters.channel}
                toHref={(value) => buildFilterHref({ ...filters, channel: value })}
              />
              <FilterRow
                label="Módulo"
                options={moduleFilterOptions}
                currentValue={filters.module}
                toHref={(value) => buildFilterHref({ ...filters, module: value })}
              />
              <FilterRow
                label="Recencia"
                options={timeframeFilterOptions}
                currentValue={filters.timeframe}
                toHref={(value) => buildFilterHref({ ...filters, timeframe: value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Comentarios contextuales de leads, cotizaciones, clientes, reservas, eventos y tareas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {entries.length > 0 ? (
                entries.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-border bg-background px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.entityTypeLabel}</Badge>
                          <span className="text-sm font-medium text-foreground">{entry.entityLabel}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.body}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <UserRound className="size-3.5" />
                        <span>
                          Autor: <strong className="text-foreground">{entry.authorName}</strong>
                        </span>
                        {entry.mentionCount > 0 ? (
                          <span>
                            · Mencionó a <strong className="text-foreground">{entry.mentionedUsers.join(', ')}</strong>
                          </span>
                        ) : null}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={entry.href as Route}>Abrir registro</Link>
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No hay actividad que coincida con los filtros actuales.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen rápido</CardTitle>
              <CardDescription>Estado del centro de comunicación con los filtros aplicados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow icon={MessageSquareText} label="Comentarios visibles" value={`${entries.length}`} />
              <SummaryRow icon={Sparkles} label="Menciones visibles" value={`${mentionsCount}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FilterRow<TValue extends string>({
  label,
  options,
  currentValue,
  toHref,
}: {
  label: string;
  options: Array<{ value: TValue; label: string }>;
  currentValue: TValue;
  toHref: (value: TValue) => Route;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={`${label}-${option.value}`} asChild size="sm" variant={option.value === currentValue ? 'default' : 'outline'}>
            <Link href={toHref(option.value)}>{option.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof MessageSquareText; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
