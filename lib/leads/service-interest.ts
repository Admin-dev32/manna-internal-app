const SERVICE_INTEREST_SEPARATOR = ' + ';

function normalizeList(values: Array<string | null | undefined>) {
  const cleaned = values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  return [...new Set(cleaned)];
}

export function parseServiceInterests(input: {
  serviceInterests?: string[] | null;
  serviceInterest?: string | null;
}) {
  if (Array.isArray(input.serviceInterests) && input.serviceInterests.length > 0) {
    return normalizeList(input.serviceInterests);
  }

  const legacy = String(input.serviceInterest ?? '').trim();
  if (!legacy) return [] as string[];

  if (legacy.startsWith('[') && legacy.endsWith(']')) {
    try {
      const parsed = JSON.parse(legacy) as string[];
      if (Array.isArray(parsed)) return normalizeList(parsed);
    } catch {
      // fallback to text splitting below
    }
  }

  if (legacy.includes(SERVICE_INTEREST_SEPARATOR)) {
    return normalizeList(legacy.split(SERVICE_INTEREST_SEPARATOR));
  }

  if (legacy.includes(',')) {
    return normalizeList(legacy.split(','));
  }

  return normalizeList([legacy]);
}

export function buildServiceInterestSummary(serviceInterests: string[]) {
  return normalizeList(serviceInterests).join(SERVICE_INTEREST_SEPARATOR);
}
