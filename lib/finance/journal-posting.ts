import type { JournalEntryLineRecord } from '@/types/finance';

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface ValidateDraftJournalForPostingInput {
  entry: {
    id: string;
    status: string;
    source_type: string;
    source_id: string;
    entry_date: string;
  } | null;
  lines: Array<Pick<JournalEntryLineRecord, 'id' | 'account_id' | 'debit' | 'credit'>>;
}

export interface ValidateDraftJournalForPostingResult {
  ok: boolean;
  errors: string[];
  totalDebits: number;
  totalCredits: number;
}

export function validateDraftJournalForPosting(input: ValidateDraftJournalForPostingInput): ValidateDraftJournalForPostingResult {
  const errors: string[] = [];

  if (!input.entry) {
    return {
      ok: false,
      errors: ['Journal entry not found.'],
      totalDebits: 0,
      totalCredits: 0,
    };
  }

  if (input.entry.status !== 'draft') {
    errors.push('Only draft journal entries can be posted.');
  }

  if (!String(input.entry.source_type ?? '').trim()) {
    errors.push('source_type is required.');
  }

  if (!String(input.entry.source_id ?? '').trim()) {
    errors.push('source_id is required.');
  }

  if (!String(input.entry.entry_date ?? '').trim()) {
    errors.push('entry_date is required.');
  }

  if (input.lines.length < 2) {
    errors.push('A journal entry requires at least two lines to post.');
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const [index, line] of input.lines.entries()) {
    if (!String(line.account_id ?? '').trim()) {
      errors.push(`Line ${index + 1} is missing account_id.`);
    }

    const debit = asNumber(line.debit);
    const credit = asNumber(line.credit);

    totalDebits += debit;
    totalCredits += credit;

    if (debit <= 0 && credit <= 0) {
      errors.push(`Line ${index + 1} must have a positive debit or credit.`);
    }

    if (debit > 0 && credit > 0) {
      errors.push(`Line ${index + 1} cannot have both debit and credit > 0.`);
    }
  }

  totalDebits = Math.round(totalDebits * 100) / 100;
  totalCredits = Math.round(totalCredits * 100) / 100;

  if (totalDebits !== totalCredits) {
    errors.push('Total debits must equal total credits.');
  }

  return {
    ok: errors.length === 0,
    errors,
    totalDebits,
    totalCredits,
  };
}
