import test from 'node:test';
import assert from 'node:assert/strict';

import { findUnsupportedTemplatePlaceholdersForPurpose, getAllowedPlaceholdersForPurpose, renderEmailTemplate } from '../services/email-templates/render.ts';

test('invoice_delivery purpose exposes invoice placeholders', () => {
  const placeholders = getAllowedPlaceholdersForPurpose('invoice_delivery');

  assert.equal(placeholders.includes('invoice_number'), true);
  assert.equal(placeholders.includes('total_amount'), true);
  assert.equal(placeholders.includes('payment_link_url'), true);
  assert.equal(placeholders.includes('business_name'), true);
});

test('invoice_reminder rejects unsupported placeholders', () => {
  const unsupported = findUnsupportedTemplatePlaceholdersForPurpose(
    'Hola {{customer_name}} {{invalid_placeholder}}',
    'invoice_reminder',
  );

  assert.deepEqual(unsupported, ['invalid_placeholder']);
});

test('renderEmailTemplate renders invoice placeholders correctly', () => {
  const rendered = renderEmailTemplate(
    {
      subject_template: 'Invoice {{invoice_number}}',
      html_template: '<p>{{customer_name}} · {{balance_due}} · {{payment_link_url}}</p>',
      text_template: 'Invoice {{invoice_number}} - {{payment_note}}',
    },
    {
      invoice_number: 'INV-20260430-ABCD1234',
      customer_name: 'Cliente Demo',
      balance_due: '$5,000.00 MXN',
      payment_link_url: 'https://payments.manna.local/demo',
      payment_note: 'Link sujeto a disponibilidad.',
    },
  );

  assert.equal(rendered.subject, 'Invoice INV-20260430-ABCD1234');
  assert.match(rendered.html, /Cliente Demo/);
  assert.match(rendered.html, /\$5,000\.00 MXN/);
  assert.match(rendered.html, /https:\/\/payments\.manna\.local\/demo/);
  assert.equal(rendered.text, 'Invoice INV-20260430-ABCD1234 - Link sujeto a disponibilidad.');
});
