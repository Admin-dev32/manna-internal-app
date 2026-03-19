'use client';

import type { ReactNode } from 'react';
import { useActionState, useMemo, useState } from 'react';
import { CircleAlert, Sparkles } from 'lucide-react';

import { AuthFeedback } from '@/components/auth/auth-feedback';
import { LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { leadEventTypeOptions, leadLanguageOptions, leadPriorityOptions, leadServiceOptions, leadSourceOptions, leadStatusOptions } from '@/config/leads';
import { initialLeadFormState } from '@/services/leads/form-state';
import type { LeadFormState } from '@/services/leads/form-state';
import type { LeadProfileOption, LeadRecord, LeadStatus } from '@/types/leads';

interface LeadFormProps {
  action: (state: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  profiles: LeadProfileOption[];
  lead?: LeadRecord | null;
  submitLabel: string;
}

interface SelectOption {
  value: string;
  label: string;
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

function getCustomSelectInitialState(value: string | null | undefined, options: SelectOption[]) {
  if (!value) {
    return { selectedValue: '', customValue: '' };
  }

  const matchesKnownOption = options.some((option) => option.value === value);
  if (matchesKnownOption) {
    return { selectedValue: value, customValue: '' };
  }

  return { selectedValue: 'Otro', customValue: value };
}

export function LeadForm({ action, profiles, lead, submitLabel }: LeadFormProps) {
  const [state, formAction] = useActionState(action, initialLeadFormState);

  const sourceOptions = useMemo<SelectOption[]>(() => leadSourceOptions.map((value) => ({ value, label: value })), []);
  const eventTypeOptions = useMemo<SelectOption[]>(() => leadEventTypeOptions.map((value) => ({ value, label: value })), []);
  const serviceOptions = useMemo<SelectOption[]>(() => leadServiceOptions.map((value) => ({ value, label: value })), []);

  const sourceInitial = getCustomSelectInitialState(lead?.source_platform, sourceOptions);
  const eventTypeInitial = getCustomSelectInitialState(lead?.event_type, eventTypeOptions);
  const serviceInitial = getCustomSelectInitialState(lead?.service_interest, serviceOptions);
  const initialStatus = (lead?.status ?? 'nuevo') as LeadStatus;

  const [statusValue, setStatusValue] = useState<LeadStatus>(initialStatus);
  const [sourceSelection, setSourceSelection] = useState(sourceInitial.selectedValue);
  const [sourceCustomValue, setSourceCustomValue] = useState(sourceInitial.customValue);
  const [eventTypeSelection, setEventTypeSelection] = useState(eventTypeInitial.selectedValue);
  const [eventTypeCustomValue, setEventTypeCustomValue] = useState(eventTypeInitial.customValue);
  const [serviceSelection, setServiceSelection] = useState(serviceInitial.selectedValue);
  const [serviceCustomValue, setServiceCustomValue] = useState(serviceInitial.customValue);

  function handleReset() {
    setStatusValue(initialStatus);
    setSourceSelection(sourceInitial.selectedValue);
    setSourceCustomValue(sourceInitial.customValue);
    setEventTypeSelection(eventTypeInitial.selectedValue);
    setEventTypeCustomValue(eventTypeInitial.customValue);
    setServiceSelection(serviceInitial.selectedValue);
    setServiceCustomValue(serviceInitial.customValue);
  }

  return (
    <form action={formAction} className="space-y-6" onReset={handleReset}>
      <AuthFeedback state={state} />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Captura guiada</p>
            <p className="text-sm text-muted-foreground">
              Registra lo mínimo necesario para no perder el seguimiento y completa detalles clave cuando existan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Paso 1 · Contacto</Badge>
            <Badge variant="secondary">Paso 2 · Evento</Badge>
            <Badge variant="secondary">Paso 3 · Seguimiento</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto y seguimiento comercial</CardTitle>
          <CardDescription>Datos principales para identificar al prospecto, asignar responsable y definir la siguiente acción.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" required>
              <Input name="full_name" defaultValue={lead?.full_name ?? ''} placeholder="Nombre del prospecto" required />
            </Field>
            <Field label="Teléfono">
              <Input name="phone" defaultValue={lead?.phone ?? ''} placeholder="55 0000 0000" inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={lead?.email ?? ''} placeholder="contacto@empresa.com" />
            </Field>
            <Field label="Idioma">
              <SelectField name="language" defaultValue={lead?.language ?? 'es'} options={leadLanguageOptions} />
            </Field>

            <CustomValueField
              label="Plataforma de origen"
              name="source_platform"
              selection={sourceSelection}
              customValue={sourceCustomValue}
              options={sourceOptions}
              placeholder="Selecciona origen"
              customLabel="Especifica el origen"
              customPlaceholder="Ej. TikTok, Facebook Ads, feria local"
              onSelectionChange={setSourceSelection}
              onCustomValueChange={setSourceCustomValue}
            />

            <Field label="Estado" required helper={<LeadStatusBadge status={statusValue} />}>
              <SelectField
                name="status"
                value={statusValue}
                options={leadStatusOptions}
                onValueChange={(value) => setStatusValue(value as LeadStatus)}
              />
            </Field>

            <Field label="Prioridad">
              <SelectField name="priority" defaultValue={lead?.priority ?? 'media'} options={leadPriorityOptions} />
            </Field>
            <Field label="Próxima acción" required>
              <Input name="next_action" defaultValue={lead?.next_action ?? ''} placeholder="Llamar y validar fecha / enviar propuesta / reagendar" required />
            </Field>
            <Field label="Fecha de seguimiento" description="Si la dejas vacía, el lead seguirá visible pero sin agenda definida.">
              <Input name="follow_up_at" type="datetime-local" defaultValue={formatDateTimeLocal(lead?.follow_up_at ?? null)} />
            </Field>
            <Field label="Responsable">
              <select
                name="responsible_profile_id"
                defaultValue={lead?.responsible_profile_id ?? ''}
                className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin asignar</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.id}
                  </option>
                ))}
              </select>
            </Field>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evento, servicio e información adicional</CardTitle>
          <CardDescription>Completa estos datos cuando ya exista contexto más claro del evento o del interés comercial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <CustomValueField
              label="Tipo de evento"
              name="event_type"
              selection={eventTypeSelection}
              customValue={eventTypeCustomValue}
              options={eventTypeOptions}
              placeholder="Selecciona tipo"
              customLabel="Especifica el tipo de evento"
              customPlaceholder="Ej. graduación, lanzamiento, feria gastronómica"
              onSelectionChange={setEventTypeSelection}
              onCustomValueChange={setEventTypeCustomValue}
            />

            <CustomValueField
              label="Servicio de interés"
              name="service_interest"
              selection={serviceSelection}
              customValue={serviceCustomValue}
              options={serviceOptions}
              placeholder="Selecciona servicio"
              customLabel="Especifica el servicio"
              customPlaceholder="Ej. barra de smoothies, estación sin alcohol, experiencia personalizada"
              onSelectionChange={setServiceSelection}
              onCustomValueChange={setServiceCustomValue}
            />

            <Field label="Fecha tentativa">
              <Input name="tentative_event_date" type="date" defaultValue={lead?.tentative_event_date ?? ''} />
            </Field>
            <Field label="Hora tentativa">
              <Input name="tentative_event_time" type="time" defaultValue={lead?.tentative_event_time ?? ''} />
            </Field>
            <Field label="Ciudad o dirección">
              <Input name="location" defaultValue={lead?.location ?? ''} placeholder="Ciudad de México / dirección" />
            </Field>
            <Field label="Cantidad de invitados">
              <Input name="guest_count" type="number" min="0" defaultValue={lead?.guest_count?.toString() ?? ''} placeholder="120" />
            </Field>
            <Field label="Total cotizado (placeholder)">
              <Input name="quoted_total" type="number" min="0" step="0.01" defaultValue={lead?.quoted_total?.toString() ?? ''} placeholder="0.00" />
            </Field>
            <Field label="Promoción ofrecida">
              <Input name="promotion_offered" defaultValue={lead?.promotion_offered ?? ''} placeholder="10% primer evento / upgrade / cortesía" />
            </Field>
          </section>

          <Field label="Notas internas básicas" description="Úsalo para objeciones, contexto del lead, acuerdos y cualquier dato que ayude al próximo seguimiento.">
            <Textarea
              name="internal_notes"
              defaultValue={lead?.internal_notes ?? ''}
              placeholder="Contexto interno, objeciones, acuerdos o datos clave del prospecto."
            />
          </Field>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-4 text-primary" />
          <p>
            Si eliges <strong>Otro</strong> en origen, tipo de evento o servicio, aparecerá un campo adicional para capturar el valor personalizado y conservarlo al crear o editar el lead.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="lg">
          <Sparkles className="size-4" />
          {submitLabel}
        </Button>
        <Button type="reset" variant="outline" size="lg">
          Restablecer campos
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  children,
  helper,
  description,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  helper?: ReactNode;
  description?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
        {helper}
      </span>
      {children}
      {description ? <span className="text-xs font-normal text-muted-foreground">{description}</span> : null}
    </label>
  );
}

function SelectField({
  name,
  defaultValue,
  value,
  options,
  placeholder,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      value={value}
      onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
      className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CustomValueField({
  label,
  name,
  selection,
  customValue,
  options,
  placeholder,
  customLabel,
  customPlaceholder,
  onSelectionChange,
  onCustomValueChange,
}: {
  label: string;
  name: string;
  selection: string;
  customValue: string;
  options: SelectOption[];
  placeholder: string;
  customLabel: string;
  customPlaceholder: string;
  onSelectionChange: (value: string) => void;
  onCustomValueChange: (value: string) => void;
}) {
  const isCustom = selection === 'Otro';

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <Field label={label}>
        <select
          name={`${name}_option`}
          value={selection}
          onChange={(event) => onSelectionChange(event.target.value)}
          className="flex h-11 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {isCustom ? (
        <Field label={customLabel} required description="Este valor personalizado se guardará en el mismo campo del lead.">
          <Input
            name={`${name}_custom`}
            value={customValue}
            onChange={(event) => onCustomValueChange(event.target.value)}
            placeholder={customPlaceholder}
            required
          />
        </Field>
      ) : null}
    </div>
  );
}
