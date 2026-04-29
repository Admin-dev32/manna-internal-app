export interface InvoiceDependencyCounts {
  invoicePaymentsCount: number;
  invoiceEmailDeliveriesCount: number;
  paymentLinksCount: number | null;
  journalEntriesCount: number;
  journalLinesCount: number;
  postedJournalRefsCount: number;
}

export function validateVoidReason(reason: string): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = reason.trim();
  if (!normalized) return { ok: false, message: 'Debes indicar una razón para anular el invoice.' };
  return { ok: true, value: normalized };
}

export function buildManualInvoiceDependencyBlockers(dependencies: InvoiceDependencyCounts): string[] {
  const blockers: string[] = [];
  if (dependencies.invoicePaymentsCount > 0) blockers.push('Cannot delete invoice with payment records.');
  if (dependencies.invoiceEmailDeliveriesCount > 0) blockers.push('Cannot delete invoice with email delivery history.');
  if ((dependencies.paymentLinksCount ?? 0) > 0) blockers.push('Cannot delete invoice with payment link history.');
  if (dependencies.journalEntriesCount > 0 || dependencies.journalLinesCount > 0) blockers.push('Cannot delete invoice with journal references.');
  return blockers;
}

export function canDeleteDraftManualInvoice(dependencies: InvoiceDependencyCounts): { ok: true } | { ok: false; message: string } {
  const blockers = buildManualInvoiceDependencyBlockers(dependencies);
  if (blockers.length > 0) {
    return { ok: false, message: blockers[0] };
  }
  return { ok: true };
}

export function canVoidManualInvoice(dependencies: InvoiceDependencyCounts): { ok: true } | { ok: false; message: string } {
  if (dependencies.postedJournalRefsCount > 0) return { ok: false, message: 'No puedes anular un invoice con asientos contables posteados.' };
  return { ok: true };
}
