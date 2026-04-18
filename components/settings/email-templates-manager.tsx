'use client';

import { useActionState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createEmailTemplateAction, toggleEmailTemplateActiveAction, updateEmailTemplateAction } from '@/services/email-templates/actions';
import { getCommunicationLanguageLabel } from '@/services/communication/language';
import { getAllowedPlaceholdersForPurpose, getEmailTemplatePreviewSampleData, renderEmailTemplate } from '@/services/email-templates/render';
import { EMAIL_TEMPLATE_PURPOSES, type EmailTemplateActionState, type EmailTemplateRecord } from '@/types/email-templates';

const initialState: EmailTemplateActionState = { status: 'idle' };

const PURPOSE_LABELS: Record<(typeof EMAIL_TEMPLATE_PURPOSES)[number], string> = {
  quote_delivery: 'Entrega de cotización',
  quote_followup: 'Seguimiento de cotización',
  payment_reminder: 'Recordatorio de pago',
  event_confirmation: 'Confirmación de evento',
  general_client_message: 'Mensaje general al cliente',
};

export function EmailTemplatesManager({ templates }: { templates: EmailTemplateRecord[] }) {
  const [createState, createAction] = useActionState(createEmailTemplateAction, initialState);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Settings</Badge>
          <Badge className="bg-white/10 text-white hover:bg-white/10">Plantillas de email</Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">Sistema de plantillas de email (V1)</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Administra asunto/HTML/texto por propósito + idioma y activa una plantilla por categoría para uso operativo.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nueva plantilla</CardTitle>
          <CardDescription>Crea plantillas reutilizables con placeholders permitidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="space-y-4">
            {createState.status !== 'idle' ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${createState.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {createState.message}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Key interno" name="key" placeholder="quote_delivery_default" required />
              <Field label="Nombre" name="name" placeholder="Plantilla base entrega cotización" required />
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="purpose">Propósito</label>
                <select id="purpose" name="purpose" defaultValue="quote_delivery" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  {EMAIL_TEMPLATE_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>{PURPOSE_LABELS[purpose]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor="language">Idioma</label>
                <select id="language" name="language" defaultValue="es" className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm">
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
            </div>

            <Field label="Asunto (template)" name="subject_template" placeholder="Cotización {{company_name}} para {{client_name}}" required />
            <TemplateTextarea label="HTML template" name="html_template" required rows={8} />
            <TemplateTextarea label="Text template (opcional)" name="text_template" rows={5} />

            <Button type="submit">Crear plantilla</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Aún no hay plantillas creadas.</CardContent>
          </Card>
        ) : (
          templates.map((template) => <EmailTemplateCard key={template.id} template={template} />)
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Placeholders permitidos</CardTitle>
          <CardDescription>Whitelist segura en V1.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {EMAIL_TEMPLATE_PURPOSES.map((purpose) => (
            <p key={purpose} className="mb-2">
              <strong>{PURPOSE_LABELS[purpose]}:</strong>{' '}
              {getAllowedPlaceholdersForPurpose(purpose).map((placeholder) => `{{${placeholder}}}`).join(', ')}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EmailTemplateCard({ template }: { template: EmailTemplateRecord }) {
  const [state, action] = useActionState(updateEmailTemplateAction.bind(null, template.id), initialState);
  const preview = renderEmailTemplate(template, getEmailTemplatePreviewSampleData());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{template.name}</CardTitle>
            <CardDescription>{template.key} · {PURPOSE_LABELS[template.purpose]} · {getCommunicationLanguageLabel(template.language)}</CardDescription>
          </div>
          <form action={toggleEmailTemplateActiveAction.bind(null, template.id, !template.is_active)}>
            <Button type="submit" variant={template.is_active ? 'secondary' : 'outline'}>
              {template.is_active ? 'Desactivar' : 'Activar'}
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Estado: <strong>{template.is_active ? 'Activa para este propósito/idioma' : 'Inactiva'}</strong>
        </div>
        <form action={action} className="space-y-4">
          {state.status !== 'idle' ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {state.message}
            </div>
          ) : null}

          <Field label="Nombre" name="name" defaultValue={template.name} required />
          <input type="hidden" name="purpose" value={template.purpose} />
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor={`language-${template.id}`}>Idioma</label>
            <select
              id={`language-${template.id}`}
              name="language"
              defaultValue={template.language}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          </div>
          <Field label="Asunto (template)" name="subject_template" defaultValue={template.subject_template} required />
          <TemplateTextarea label="HTML template" name="html_template" defaultValue={template.html_template} rows={8} required />
          <TemplateTextarea label="Text template" name="text_template" defaultValue={template.text_template ?? ''} rows={5} />
          <p className="text-xs text-muted-foreground">
            Placeholders para {PURPOSE_LABELS[template.purpose]}: {getAllowedPlaceholdersForPurpose(template.purpose).map((placeholder) => `{{${placeholder}}}`).join(', ')}
          </p>

          <Button type="submit">Guardar cambios</Button>
        </form>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Preview (sample data)</p>
          <p className="mt-2 text-sm"><strong>Asunto:</strong> {preview.subject}</p>
          <div className="mt-3 rounded-xl border border-border bg-background p-3 text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
          {preview.text ? <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-xs">{preview.text}</pre> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, name, defaultValue, placeholder, required = false }: { label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor={name}>{label}</label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} />
    </div>
  );
}

function TemplateTextarea({ label, name, defaultValue, rows, required = false }: { label: string; name: string; defaultValue?: string; rows: number; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-primary" htmlFor={name}>{label}</label>
      <Textarea id={name} name={name} defaultValue={defaultValue} rows={rows} required={required} />
    </div>
  );
}
