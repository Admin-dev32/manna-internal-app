export interface SafeFormatDateTimeOptions {
  locale?: string;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  fallback?: string;
}

function shouldWarnInvalidDate() {
  return process.env.NODE_ENV !== 'production';
}

export function safeFormatDateTime(
  value: string | number | Date | null | undefined,
  options: SafeFormatDateTimeOptions = {},
) {
  const {
    locale = 'es-MX',
    dateStyle = 'medium',
    timeStyle = 'short',
    fallback = '—',
  } = options;

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (shouldWarnInvalidDate()) {
      console.warn('[safeFormatDateTime] Invalid date value received.', { value });
    }
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date);
}
