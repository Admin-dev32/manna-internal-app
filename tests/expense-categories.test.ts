import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isGenericLegacyExpenseCategory,
  resolveExpenseCategorySummaryLabel,
  resolveLegacyExpenseCategoryText,
} from '../lib/finance/expense-categories.ts';

test('resolveExpenseCategorySummaryLabel prefers controlled category when category_id exists', () => {
  const label = resolveExpenseCategorySummaryLabel({
    categoryId: 'abc-123',
    controlledCategoryName: 'Food & Ingredients',
    legacyCategory: 'food',
  });
  assert.equal(label, 'Food & Ingredients');
});

test('resolveExpenseCategorySummaryLabel falls back to legacy category when controlled category missing', () => {
  const label = resolveExpenseCategorySummaryLabel({
    categoryId: null,
    controlledCategoryName: null,
    legacyCategory: 'legacy transport',
  });
  assert.equal(label, 'legacy transport');
});

test('resolveLegacyExpenseCategoryText uses selected category when legacy value is generic', () => {
  const text = resolveLegacyExpenseCategoryText({
    legacyCategory: 'other',
    selectedCategoryName: 'Vehicle & Fuel',
  });
  assert.equal(text, 'Vehicle & Fuel');
});

test('isGenericLegacyExpenseCategory detects generic values', () => {
  assert.equal(isGenericLegacyExpenseCategory('Other'), true);
  assert.equal(isGenericLegacyExpenseCategory(' n/a '), true);
  assert.equal(isGenericLegacyExpenseCategory('Office & Software'), false);
});
