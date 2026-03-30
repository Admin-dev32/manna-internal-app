'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';
import { CalendarDays } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { PreEventStatusBadge } from '@/components/pre-events/pre-event-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { preEventStatusOptions } from '@/config/pre-events';
import { initialPreEventFormState } from '@/services/pre-events/form-state';
import type { PreEventFormState } from '@/services/pre-events/form-state';
import type { ClientRecord } from '@/types/clients';
import type { LeadRecord } from '@/types/leads';
import type { PreEventRecord, PreEventStatus } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

interface PreEventFormProps {
  action: (state: PreEventFormState, formData: FormData) => Promise<PreEventFormState>;
  client: ClientRecord;
  lead: LeadRecord | null;
  quote: QuoteRecord;
  preEvent?: PreEventRecord | null;
  submitLabel: string;
}

export function PreEventForm({ action, client, lead, quote, preEvent, submitLabel }: PreEventFormProps) {
  const [state, formAction] = useActionState(action, initialPreEventFormState);
  const initialStatus = (preEvent?.status ?? 'pendiente') as PreEventStatus;

  return (
    <form action={formAction} className="space-y-6">
      <AuthFeedback state={state} />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Reserva operativa inicial</p>
            <p className="text-sm text-muted-foreground">Puente ligero entre venta cerrada y operación futura del evento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Cliente: {client.full_name}</Badge>
            <PreEventStatusBadge status={initialStatus} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos base de reserva</CardTitle>
          <CardDescription>Hereda contexto del lead y la cotización aceptada, pero permite afinar lo confirmado operativamente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Estado de la reserva">
            <SelectField name="status" defaultValue={initialStatus} options={preEventStatusOptions} />
          </Field>
          <Field label="Fecha confirmada">
            <Input name="confirmed_date" type="date" defaultValue={preEvent?.confirmed_date ?? lead?.tentative_event_date ?? ''} />
          </Field>
          <Field label="Hora confirmada">
            <Input name="confirmed_time" type="time" defaultValue={preEvent?.confirmed_time ?? lead?.tentative_event_time ?? ''} />
          </Field>
          <Field label="Dirección / location">
            <Input name="location" defaultValue={preEvent?.location ?? lead?.location ?? client.location ?? ''} placeholder="Dirección confirmada del servicio" />
          </Field>
          <Field label="Tipo de evento">
            <Input name="event_type" defaultValue={preEvent?.event_type ?? lead?.event_type ?? ''} placeholder="Ej. boda, corporativo, activación" />
          </Field>
          <Field label="Servicio o bar contratado">
            <Input name="booked_service" defaultValue={preEvent?.booked_service ?? lead?.service_interest ?? ''} placeholder="Servicio confirmado" />
          </Field>
          <Field label="Invitados confirmados">
            <Input name="confirmed_guests" type="number" min="0" defaultValue={preEvent?.confirmed_guests?.toString() ?? lead?.guest_count?.toString() ?? ''} placeholder="0" />
          </Field>
          <Field label="Cotización origen">
            <Input value={`#${quote.id.slice(0, 8)} · ${quote.status}`} readOnly className="bg-muted/20" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas operativas iniciales</CardTitle>
          <CardDescription>Define lo ya confirmado y lo que aún queda pendiente antes del módulo completo de Eventos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            name="initial_operations_notes"
            defaultValue={preEvent?.initial_operations_notes ?? quote.notes ?? lead?.internal_notes ?? ''}
            placeholder="Notas operativas iniciales, restricciones, pendientes de confirmación o acuerdos clave."
          />
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 text-primary" />
              <p>
                Este bloque no sustituye el módulo de Eventos. Solo deja la reserva operativa inicial lista para crecer a planeación completa después.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="lg">{submitLabel}</Button>
        <Button type="reset" variant="outline" size="lg">Restablecer campos</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SelectField({ name, defaultValue, options }: { name: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
