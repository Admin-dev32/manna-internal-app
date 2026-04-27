import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canEditContractorPayoutDraft,
  validateContractorPayoutAssignmentConsistency,
  validateContractorPayoutDraftInput,
} from '../lib/finance/contractor-payouts.ts';

test('validateContractorPayoutDraftInput accepts valid draft payload', () => {
  const result = validateContractorPayoutDraftInput({
    profile_id: 'profile-1',
    event_id: 'event-1',
    assignment_id: 'assignment-1',
    amount: 250,
    payment_method: 'zelle',
    source_expense_id: null,
  });

  assert.equal(result.ok, true);
});

test('validateContractorPayoutDraftInput blocks source_expense_id in this phase', () => {
  const result = validateContractorPayoutDraftInput({
    profile_id: 'profile-1',
    event_id: 'event-1',
    assignment_id: null,
    amount: 100,
    source_expense_id: 'expense-1',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /source_expense_id/);
  }
});

test('validateContractorPayoutAssignmentConsistency fails on assignment/event mismatch', () => {
  const result = validateContractorPayoutAssignmentConsistency({
    eventId: 'event-1',
    profileId: 'profile-1',
    assignment: {
      id: 'assignment-1',
      event_id: 'event-2',
      profile_id: 'profile-1',
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /event_id/);
  }
});

test('validateContractorPayoutAssignmentConsistency fails on assignment/profile mismatch', () => {
  const result = validateContractorPayoutAssignmentConsistency({
    eventId: 'event-1',
    profileId: 'profile-1',
    assignment: {
      id: 'assignment-1',
      event_id: 'event-1',
      profile_id: 'profile-2',
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /profile_id/);
  }
});

test('canEditContractorPayoutDraft allows only draft status', () => {
  assert.equal(canEditContractorPayoutDraft('draft'), true);
  assert.equal(canEditContractorPayoutDraft('approved'), false);
  assert.equal(canEditContractorPayoutDraft('paid'), false);
  assert.equal(canEditContractorPayoutDraft('cancelled'), false);
  assert.equal(canEditContractorPayoutDraft('reversed'), false);
});
