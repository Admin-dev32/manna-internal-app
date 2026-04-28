import test from 'node:test';
import assert from 'node:assert/strict';

import { validateDraftJournalForPosting, type ValidateDraftJournalForPostingInput } from '../lib/finance/journal-posting.ts';

function baseInput(): ValidateDraftJournalForPostingInput {
  return {
    entry: {
      id: 'je-1',
      status: 'draft',
      source_type: 'invoice_issue',
      source_id: 'inv-1',
      entry_date: '2026-05-01',
    },
    lines: [
      { id: 'l1', account_id: 'a1', debit: 100, credit: 0 },
      { id: 'l2', account_id: 'a2', debit: 0, credit: 100 },
    ],
  };
}

test('valid draft accepted', () => {
  const result = validateDraftJournalForPosting(baseInput());
  assert.equal(result.ok, true);
});

test('non-draft rejected', () => {
  const input = baseInput();
  input.entry!.status = 'posted';
  const result = validateDraftJournalForPosting(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /Only draft journal entries can be posted/i);
});

test('fewer than 2 lines rejected', () => {
  const input = baseInput();
  input.lines = [input.lines[0]!];
  const result = validateDraftJournalForPosting(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /at least two lines/i);
});

test('missing account rejected', () => {
  const input = baseInput();
  input.lines[0]!.account_id = '';
  const result = validateDraftJournalForPosting(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /missing account_id/i);
});

test('unbalanced rejected', () => {
  const input = baseInput();
  input.lines[1]!.credit = 90;
  const result = validateDraftJournalForPosting(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /Total debits must equal total credits/i);
});

test('line with debit+credit rejected', () => {
  const input = baseInput();
  input.lines[0]!.credit = 1;
  const result = validateDraftJournalForPosting(input);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /cannot have both debit and credit/i);
});
