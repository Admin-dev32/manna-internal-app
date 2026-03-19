'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { leadEventTypeOptions, leadLanguageOptions, leadPriorityOptions, leadServiceOptions, leadSourceOptions, leadStatusOptions } from '@/config/leads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AuthFeedback } from '@/components/auth/auth-feedback';
import { LeadStatusBadge } from '@/components/leads/lead-status-badge';
import { initialLeadFormState } from '@/services/leads/form-state';
import type { LeadFormState } from '@/services/leads/form-state';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';

interface LeadFormProps {
  action: (state: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  profiles: LeadProfileOption[];
  lead?: LeadRecord | null;
  submitLabel: string;
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

export function LeadForm({ action, profiles, lead, submitLabel }: LeadFormProps) {
  const [state, formAction] = useActionState(action, initialLeadFormState);

  return (
    <form action={formAction} className="space-y-6">
      <AuthFeedback state={state} />

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" required>
          <Input name="full_name" defaultValue={lead?.full_name ?? ''} placeholder="Nombre del prospecto" required />
        </Field>
        <Field label="Teléfono">
          <Input name="phone" defaultValue={lead?.phone ?? ''} placeholder="55 0000 0000" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={lead?.email ?? ''} placeholder="contacto@empresa.com" />
        </Field>
        <Field label="Idioma">
          <SelectField name="language" defaultValue={lead?.language ?? 'es'} options={leadLanguageOptions} />
        </Field>
        <Field label="Plataforma de origen">
          <SelectField
            name="source_platform"
            defaultValue={lead?.source_platform ?? ''}
            placeholder="Selecciona origen"
            options={leadSourceOptions.map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Estado" required helper={<LeadStatusBadge status={lead?.status ?? 'nuevo'} />}>
          <SelectField name="status" defaultValue={lead?.status ?? 'nuevo'} options={leadStatusOptions} />
        </Field>
        <Field label="Prioridad">
          <SelectField name="priority" defaultValue={lead?.priority ?? 'media'} options={leadPriorityOptions} />
        </Field>
        <Field label="Próxima acción" required>
          <Input name="next_action" defaultValue={lead?.next_action ?? ''} placeholder="Llamar y validar fecha" required />
        </Field>
        <Field label="Fecha de seguimiento">
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

      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de evento">
          <SelectField
            name="event_type"
            defaultValue={lead?.event_type ?? ''}
            placeholder="Selecciona tipo"
            options={leadEventTypeOptions.map((value) => ({ value, label: value }))}
          />
        </Field>
        <Field label="Servicio de interés">
          <SelectField
            name="service_interest"
            defaultValue={lead?.service_interest ?? ''}
            placeholder="Selecciona servicio"
            options={leadServiceOptions.map((value) => ({ value, label: value }))}
          />
        </Field>
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
          <Input name="promotion_offered" defaultValue={lead?.promotion_offered ?? ''} placeholder="10% primer evento" />
        </Field>
      </section>

      <Field label="Notas internas básicas">
        <Textarea
          name="internal_notes"
          defaultValue={lead?.internal_notes ?? ''}
          placeholder="Contexto interno, objeciones, acuerdos o datos clave del prospecto."
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit">{submitLabel}</Button>
        <Button type="reset" variant="outline">
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
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      <span className="flex items-center gap-2">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
        {helper}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
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
