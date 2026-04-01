'use client';

import { useActionState } from 'react';
import { CalendarSync, ExternalLink } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { initialEventCalendarSyncFormState } from '@/services/events/calendar-form-state';
import type { EventCalendarSyncFormState } from '@/services/events/calendar-form-state';
import type { EventCalendarSyncRecord } from '@/types/calendar';

function formatDateTime(value: string | null) {
  if (!value) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function EventCalendarSyncCard({
  sync,
  requirements,
  action,
}: {
  sync: EventCalendarSyncRecord | null;
  requirements: string[];
  action: (state: EventCalendarSyncFormState, formData: FormData) => Promise<EventCalendarSyncFormState>;
}) {
  const [state, formAction] = useActionState(action, initialEventCalendarSyncFormState);
  const isSynced = (sync?.sync_status === 'synced' || sync?.sync_status === 'reconciled') && Boolean(sync.external_event_id);
  const statusLabel =
    sync?.sync_status === 'reconciled'
      ? 'Reconciliado'
      : sync?.sync_status === 'stale'
        ? 'Sincronización obsoleta'
        : isSynced
          ? 'Sincronizado'
          : sync?.sync_status === 'error'
            ? 'Con error'
            : 'No sincronizado';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarSync className="size-4" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Sincronización manual y controlada para evitar duplicados con el sistema maestro de webhooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthFeedback state={state} />

        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
          <p>
            Estado:{' '}
            <Badge variant={isSynced ? 'success' : sync?.sync_status === 'error' ? 'warning' : 'outline'}>
              {statusLabel}
            </Badge>
          </p>
          {sync?.sync_origin === 'inherited' ? <p className="mt-1 text-sky-700">Ownership heredado desde Reserva.</p> : null}
          {sync?.ownership_note ? <p className="mt-1 text-muted-foreground">{sync.ownership_note}</p> : null}
          <p className="mt-1">Última sincronización: {formatDateTime(sync?.synced_at ?? null)}</p>
          {sync?.last_error ? <p className="mt-1 text-amber-700">Último error: {sync.last_error}</p> : null}
        </div>

        {requirements.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Faltan datos para sincronizar</p>
            {requirements.map((item) => (
              <div key={item} className="rounded-xl border border-amber-200 bg-white px-3 py-2">{item}</div>
            ))}
          </div>
        ) : (
          <form action={formAction} className="flex flex-wrap gap-2">
            <Button type="submit">{isSynced ? 'Actualizar en Google Calendar' : 'Sincronizar con Google Calendar'}</Button>
            {sync?.external_event_url ? (
              <Button asChild variant="outline">
                <a href={sync.external_event_url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" />
                  Abrir en Google Calendar
                </a>
              </Button>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
