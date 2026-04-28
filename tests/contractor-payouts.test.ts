import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canApproveContractorPayout,
  canMarkContractorPayoutPaid,
  canTransitionContractorPayoutStatus,
  canEditContractorPayoutDraft,
  canCancelContractorPayout,
  validateContractorPayoutAssignmentConsistency,
  validateContractorPayoutDraftInput,
  validateContractorPayoutPaidInput,
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

test('status transition draft -> approved is allowed', () => {
  assert.equal(canApproveContractorPayout('draft'), true);
  assert.equal(canTransitionContractorPayoutStatus('draft', 'approved'), true);
});

test('status transition approved -> paid is allowed', () => {
  assert.equal(canMarkContractorPayoutPaid('approved'), true);
  assert.equal(canTransitionContractorPayoutStatus('approved', 'paid'), true);
});

test('status transition draft -> paid is not allowed', () => {
  assert.equal(canMarkContractorPayoutPaid('draft'), false);
  assert.equal(canTransitionContractorPayoutStatus('draft', 'paid'), false);
});

test('status transition paid -> cancelled is not allowed', () => {
  assert.equal(canCancelContractorPayout('paid'), false);
  assert.equal(canTransitionContractorPayoutStatus('paid', 'cancelled'), false);
});

test('status transition draft/approved -> cancelled is allowed', () => {
  assert.equal(canCancelContractorPayout('draft'), true);
  assert.equal(canCancelContractorPayout('approved'), true);
  assert.equal(canTransitionContractorPayoutStatus('draft', 'cancelled'), true);
  assert.equal(canTransitionContractorPayoutStatus('approved', 'cancelled'), true);
});

test('validateContractorPayoutPaidInput rejects invalid payment_method', () => {
  const result = validateContractorPayoutPaidInput({
    payment_method: 'wire',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /Método de pago inválido/);
  }
});

test('validateContractorPayoutPaidInput accepts YYYY-MM-DD payout_date', () => {
  const result = validateContractorPayoutPaidInput({
    payout_date: '2026-04-27',
  });

  assert.equal(result.ok, true);
});

test('validateContractorPayoutPaidInput rejects MM/DD/YYYY payout_date', () => {
  const result = validateContractorPayoutPaidInput({
    payout_date: '04/27/2026',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /YYYY-MM-DD/);
  }
});

test('validateContractorPayoutPaidInput rejects empty payout_date', () => {
  const result = validateContractorPayoutPaidInput({
    payout_date: '',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /YYYY-MM-DD/);
  }
});

test('validateContractorPayoutPaidInput rejects invalid date/text payout_date', () => {
  const invalidDateResult = validateContractorPayoutPaidInput({
    payout_date: '2026-02-30',
  });
  const textResult = validateContractorPayoutPaidInput({
    payout_date: 'not-a-date',
  });

  assert.equal(invalidDateResult.ok, false);
  assert.equal(textResult.ok, false);
  if (!invalidDateResult.ok) {
    assert.match(invalidDateResult.message, /fecha válida|YYYY-MM-DD/);
  }
  if (!textResult.ok) {
    assert.match(textResult.message, /YYYY-MM-DD/);
  }
});
