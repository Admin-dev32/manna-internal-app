import test from 'node:test';
import assert from 'node:assert/strict';

import { canDeleteDraftManualInvoice, canVoidManualInvoice, validateVoidReason } from '../lib/finance/manual-invoice-dependencies.ts';

const baseDependencies = {
  invoicePaymentsCount: 0,
  invoiceEmailDeliveriesCount: 0,
  paymentLinksCount: 0,
  journalEntriesCount: 0,
  journalLinesCount: 0,
  postedJournalRefsCount: 0,
};

test('canDeleteDraftManualInvoice blocks when succeeded payments exist', () => {
  const result = canDeleteDraftManualInvoice({ ...baseDependencies, invoicePaymentsCount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /payment records/i);
});

test('canDeleteDraftManualInvoice blocks when email deliveries exist', () => {
  const result = canDeleteDraftManualInvoice({ ...baseDependencies, invoiceEmailDeliveriesCount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /email delivery history/i);
});

test('canDeleteDraftManualInvoice blocks when payment links exist', () => {
  const result = canDeleteDraftManualInvoice({ ...baseDependencies, paymentLinksCount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /payment link history/i);
});

test('canDeleteDraftManualInvoice blocks when journal entry references exist', () => {
  const result = canDeleteDraftManualInvoice({ ...baseDependencies, journalEntriesCount: 2 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /journal references/i);
});

test('canDeleteDraftManualInvoice blocks when journal line references exist', () => {
  const result = canDeleteDraftManualInvoice({ ...baseDependencies, journalLinesCount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /journal references/i);
});

test('canDeleteDraftManualInvoice allows delete when no dependencies exist', () => {
  const result = canDeleteDraftManualInvoice(baseDependencies);
  assert.equal(result.ok, true);
});

test('canVoidManualInvoice blocks when posted journal lines exist', () => {
  const result = canVoidManualInvoice({ ...baseDependencies, postedJournalRefsCount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /asientos contables posteados/i);
});

test('canVoidManualInvoice allows void when posted journal lines do not exist', () => {
  const result = canVoidManualInvoice({ ...baseDependencies, invoicePaymentsCount: 2 });
  assert.equal(result.ok, true);
});

test('validateVoidReason requires non-empty reason', () => {
  const result = validateVoidReason('   ');
  assert.equal(result.ok, false);
});

test('validateVoidReason trims and returns normalized reason', () => {
  const result = validateVoidReason('  duplicate invoice  ');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 'duplicate invoice');
});
