function normalizeCategoryValue(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const GENERIC_CATEGORY_VALUES = new Set(['', 'other', 'otros', 'otro', 'general', 'n/a', 'na', 'misc']);

export function isGenericLegacyExpenseCategory(value: string | null | undefined) {
  return GENERIC_CATEGORY_VALUES.has(normalizeCategoryValue(value));
}

export function resolveLegacyExpenseCategoryText(args: {
  legacyCategory: string | null | undefined;
  selectedCategoryName: string | null | undefined;
}) {
  const legacy = String(args.legacyCategory ?? '').trim();
  const selected = String(args.selectedCategoryName ?? '').trim();
  if (!selected) return legacy;
  if (!legacy || isGenericLegacyExpenseCategory(legacy)) return selected;
  return legacy;
}

export function resolveExpenseCategorySummaryLabel(args: {
  categoryId: string | null | undefined;
  controlledCategoryName: string | null | undefined;
  legacyCategory: string | null | undefined;
}) {
  if (args.categoryId && args.controlledCategoryName) {
    return args.controlledCategoryName;
  }

  const legacy = String(args.legacyCategory ?? '').trim();
  return legacy || 'Uncategorized';
}
