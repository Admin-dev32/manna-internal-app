import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInvoiceEmailPlaceholderPayload,
  resolveInvoiceEmailRecipient,
  resolveInvoiceEmailSubject,
} from '../services/invoices/email-send-helpers.ts';
import type { InvoiceEmailPlaceholderSource } from '../services/invoices/email-send-helpers.ts';

function buildDetail(overrides?: Partial<InvoiceEmailPlaceholderSource>): InvoiceEmailPlaceholderSource {
  return {
    invoice: {
      manual_customer_name: 'Manual Customer',
      manual_customer_email: 'manual@example.com',
      invoice_number: 'INV-20260427-AAAA1111',
      status: 'issued',
      currency: 'usd',
      subtotal: 100,
      discount_amount: 10,
      total_amount: 90,
      deposit_amount: 20,
      balance_due: 70,
      issued_at: '2026-04-27T12:00:00.000Z',
      due_at: '2026-05-01T12:00:00.000Z',
      notes: 'Test notes',
    },
    client: {
      full_name: 'Client Name',
      email: 'client@example.com',
    },
    preEvent: null,
    event: null,
    paymentLinks: [
      {
        external_url: 'https://payments.example.com/link-1',
      },
    ],
    source_label: 'Manual',
    ...overrides,
  };
}

test('resolveInvoiceEmailRecipient prioritizes recipientOverride', () => {
  const result = resolveInvoiceEmailRecipient({
    recipientOverride: 'override@example.com',
    clientEmail: 'client@example.com',
    manualCustomerEmail: 'manual@example.com',
  });

  assert.equal(result.recipient, 'override@example.com');
  assert.equal(result.source, 'override');
  assert.equal(result.error, null);
});

test('resolveInvoiceEmailRecipient rejects invalid recipientOverride', () => {
  const result = resolveInvoiceEmailRecipient({ recipientOverride: 'invalid-email' });

  assert.equal(result.recipient, null);
  assert.equal(result.source, 'override');
  assert.match(result.error ?? '', /inválido/);
});

test('buildInvoiceEmailPlaceholderPayload handles no payment link case', () => {
  const detail = buildDetail({ paymentLinks: [] });
  const payload = buildInvoiceEmailPlaceholderPayload(detail, { now: new Date('2026-04-27T00:00:00.000Z') });

  assert.equal(payload.payment_link_url, '');
  assert.match(payload.payment_note ?? '', /No online payment link available yet/i);
  assert.equal(payload.customer_email, 'client@example.com');
});

test('resolveInvoiceEmailSubject fallback order works', () => {
  const fromOverride = resolveInvoiceEmailSubject({
    subjectOverride: 'Custom subject',
    renderedSubject: 'Template subject',
    invoiceNumber: 'INV-1',
  });
  assert.equal(fromOverride, 'Custom subject');

  const fromTemplate = resolveInvoiceEmailSubject({
    renderedSubject: 'Template subject',
    invoiceNumber: 'INV-1',
  });
  assert.equal(fromTemplate, 'Template subject');

  const fallback = resolveInvoiceEmailSubject({ invoiceNumber: 'INV-1' });
  assert.equal(fallback, 'Invoice INV-1');
});
