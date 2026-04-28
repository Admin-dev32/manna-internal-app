import test from 'node:test';
import assert from 'node:assert/strict';

import { validateCreateManualInvoiceInput } from '../lib/finance/manual-invoices.ts';

test('validateCreateManualInvoiceInput requires clientId or manualCustomerName', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    subtotal: 200,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /clientId o manualCustomerName/);
  }
});

test('validateCreateManualInvoiceInput rejects subtotal <= 0', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    subtotal: 0,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /subtotal/);
  }
});

test('validateCreateManualInvoiceInput rejects discount greater than subtotal', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    subtotal: 100,
    discountAmount: 120,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /discountAmount/);
  }
});

test('validateCreateManualInvoiceInput rejects deposit greater than total', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    subtotal: 100,
    discountAmount: 10,
    depositAmount: 95,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /depositAmount/);
  }
});

test('validateCreateManualInvoiceInput rejects invalid dueAt format', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    subtotal: 100,
    dueAt: '04/27/2026',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /YYYY-MM-DD/);
  }
});

test('validateCreateManualInvoiceInput rejects invalid manualCustomerEmail', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    manualCustomerEmail: 'invalid-email',
    subtotal: 100,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /manualCustomerEmail/);
  }
});

test('validateCreateManualInvoiceInput computes total and balance correctly', () => {
  const result = validateCreateManualInvoiceInput({
    manualTitle: 'Invoice manual',
    manualCustomerName: 'Cliente Manual',
    subtotal: 250.55,
    discountAmount: 50.15,
    depositAmount: 100,
    dueAt: '2026-05-12',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.totalAmount, 200.4);
    assert.equal(result.value.balanceDue, 100.4);
    assert.match(result.value.dueAtIso ?? '', /^2026-05-12T00:00:00.000Z$/);
  }
});
