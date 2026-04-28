-- Phase 7G.3: invoice email template purposes (sin envío funcional).

alter table public.email_templates
  drop constraint if exists email_templates_purpose_check;

alter table public.email_templates
  add constraint email_templates_purpose_check
  check (
    purpose in (
      'quote_delivery',
      'quote_followup',
      'payment_reminder',
      'invoice_delivery',
      'invoice_reminder',
      'event_confirmation',
      'general_client_message'
    )
  );

insert into public.email_templates (
  key,
  name,
  purpose,
  language,
  subject_template,
  html_template,
  text_template,
  is_active,
  updated_by
)
values
  (
    'invoice_delivery_default_es',
    'Invoice delivery (ES) default',
    'invoice_delivery',
    'es',
    'Invoice {{invoice_number}} · {{business_name}}',
    '<p>Hola {{customer_name}},</p><p>Te compartimos tu invoice <strong>{{invoice_number}}</strong>.</p><p>Total: <strong>{{total_amount}}</strong><br/>Saldo pendiente: <strong>{{balance_due}}</strong><br/>Vence: <strong>{{due_at}}</strong></p><p>{{notes}}</p><p>{{payment_note}}</p><p><a href="{{payment_link_url}}">{{payment_link_label}}</a></p><p>Si no ves un link activo, responde este correo y con gusto te ayudamos.</p><p>{{business_name}} · {{website_url}}</p>',
    'Hola {{customer_name}},\nInvoice {{invoice_number}}\nTotal: {{total_amount}}\nSaldo pendiente: {{balance_due}}\nVence: {{due_at}}\n{{notes}}\n{{payment_note}}\n{{payment_link_label}}: {{payment_link_url}}\n{{business_name}} · {{website_url}}',
    false,
    null
  ),
  (
    'invoice_reminder_default_es',
    'Invoice reminder (ES) default',
    'invoice_reminder',
    'es',
    'Recordatorio invoice {{invoice_number}} · {{business_name}}',
    '<p>Hola {{customer_name}},</p><p>Este es un recordatorio amable de tu invoice <strong>{{invoice_number}}</strong>.</p><p>Saldo pendiente: <strong>{{balance_due}}</strong><br/>Fecha límite: <strong>{{due_at}}</strong></p><p>{{payment_note}}</p><p><a href="{{payment_link_url}}">{{payment_link_label}}</a></p><p>Si ya realizaste el pago, puedes ignorar este mensaje.</p><p>{{business_name}} · {{website_url}}</p>',
    'Hola {{customer_name}},\nRecordatorio invoice {{invoice_number}}\nSaldo pendiente: {{balance_due}}\nFecha límite: {{due_at}}\n{{payment_note}}\n{{payment_link_label}}: {{payment_link_url}}\nSi ya pagaste, ignora este mensaje.\n{{business_name}} · {{website_url}}',
    false,
    null
  )
on conflict (key) do nothing;
