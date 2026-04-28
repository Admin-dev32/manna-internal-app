export function normalizeFinanceExpenseEventSearchValue(value: string | null | undefined) {
  return String(value ?? '')
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function buildFinanceExpenseEventSearchText(parts: Array<string | null | undefined>) {
  return normalizeFinanceExpenseEventSearchValue(parts.filter(Boolean).join(' '));
}

export function matchesFinanceExpenseEventSearch(searchText: string, query: string) {
  const normalizedQuery = normalizeFinanceExpenseEventSearchValue(query);
  if (!normalizedQuery) return true;
  return normalizeFinanceExpenseEventSearchValue(searchText).includes(normalizedQuery);
}
