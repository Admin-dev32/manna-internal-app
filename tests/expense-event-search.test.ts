import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFinanceExpenseEventSearchText,
  matchesFinanceExpenseEventSearch,
  normalizeFinanceExpenseEventSearchValue,
} from '../lib/finance/expense-event-search.ts';

test('normalizeFinanceExpenseEventSearchValue removes accents and trims', () => {
  assert.equal(normalizeFinanceExpenseEventSearchValue('  Bóda Ána  '), 'boda ana');
});

test('buildFinanceExpenseEventSearchText joins and normalizes searchable parts', () => {
  const searchText = buildFinanceExpenseEventSearchText(['Boda', '2026-05-24', 'Cliente Demo', '#abc123']);
  assert.equal(searchText, 'boda 2026-05-24 cliente demo #abc123');
});

test('matchesFinanceExpenseEventSearch matches normalized queries', () => {
  const searchText = 'boda 2026-05-24 cliente demo #abc123';
  assert.equal(matchesFinanceExpenseEventSearch(searchText, 'BÓDA'), true);
  assert.equal(matchesFinanceExpenseEventSearch(searchText, 'cliente'), true);
  assert.equal(matchesFinanceExpenseEventSearch(searchText, 'xyz-not-found'), false);
});
