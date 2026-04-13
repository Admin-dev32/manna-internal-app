'use client';

import { useActionState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveBusinessSettingsAction } from '@/services/business-settings/actions';
import type { BusinessSettingsFormState } from '@/types/business-settings';

type BusinessSettingsEditable = {
  company_name: string;
  logo_url: string | null;
  website_url: string;
  zelle_recipient_name: string | null;
  zelle_recipient_contact: string | null;
  zelle_instructions: string;
  email_from_name: string;
  email_reply_to: string | null;
  operational_timezone: string;
  internal_payments_source: string;
  internal_payments_system: string;
};

const initialState: BusinessSettingsFormState = { status: 'idle' };

export function BusinessSettingsForm({ settings }: { settings: BusinessSettingsEditable }) {
  const [state, action] = useActionState(saveBusinessSettingsAction, initialState);

  return (
    <form action={action} className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Settings</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Negocio y pagos</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Configuración comercial editable</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Administra branding, textos y parámetros operativos no sensibles. Las llaves/API keys secretas permanecen en env/Vercel.
          </p>
        </div>
      </section>

      {state.status !== 'idle' ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {state.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Branding comercial (quotes + emails)</CardTitle>
          <CardDescription>Valores visibles para clientes en cotizaciones, previews y correos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre de compañía" name="company_name" defaultValue={settings.company_name} required />
          <Field label="Website URL" name="website_url" defaultValue={settings.website_url} required />
          <Field label="Logo URL" name="logo_url" defaultValue={settings.logo_url ?? ''} />
          <Field label="Email from name" name="email_from_name" defaultValue={settings.email_from_name} required />
          <Field label="Email reply-to" name="email_reply_to" defaultValue={settings.email_reply_to ?? ''} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zelle y parámetros operativos</CardTitle>
          <CardDescription>Información no sensible usada en comunicación y payloads de cobro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Receptor Zelle" name="zelle_recipient_name" defaultValue={settings.zelle_recipient_name ?? ''} />
            <Field label="Dato de contacto Zelle" name="zelle_recipient_contact" defaultValue={settings.zelle_recipient_contact ?? ''} />
            <Field label="Timezone operativa" name="operational_timezone" defaultValue={settings.operational_timezone} required />
            <Field label="Payments source (no secreto)" name="internal_payments_source" defaultValue={settings.internal_payments_source} required />
            <Field label="Payments system (no secreto)" name="internal_payments_system" defaultValue={settings.internal_payments_system} required />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="zelle_instructions">
              Instrucciones Zelle
            </label>
            <Textarea id="zelle_instructions" name="zelle_instructions" defaultValue={settings.zelle_instructions} rows={4} required />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">Guardar configuración</Button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, required = false }: { label: string; name: string; defaultValue: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor={name}>
        {label}
      </label>
      <Input id={name} name={name} defaultValue={defaultValue} required={required} />
    </div>
  );
}
