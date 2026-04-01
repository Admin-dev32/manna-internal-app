import { QuoteDetail } from '@/components/quotes/quote-detail';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionContext } from '@/services/auth/session';
import { getQuoteFinancialSheetDraft } from '@/services/finance/queries';
import { getInvoicesByQuoteId } from '@/services/invoices/queries';
import { getQuoteDetailPageData } from '@/services/quotes/queries';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const [{ client, lead, leadRecord, preEvent, paymentLinks, emailDeliveries, manualDeliveries, profileMap, quote }, session] = await Promise.all([
    getQuoteDetailPageData(quoteId),
    getSessionContext(),
  ]);

  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view'));
  const canManageFinanceSheet = Boolean(session.user && hasPermission(session.user, 'finance.edit_quote_sheet'));
  const canViewInvoices = Boolean(session.user && hasPermission(session.user, 'finance.invoices.view'));
  const canManageInvoices = Boolean(session.user && hasPermission(session.user, 'finance.invoices.manage'));

  const [financialSheetDraft, invoices] = await Promise.all([
    canViewFinance ? getQuoteFinancialSheetDraft(quote) : Promise.resolve(null),
    canViewInvoices ? getInvoicesByQuoteId(quote.id) : Promise.resolve([]),
  ]);

  return (
    <QuoteDetail
      quote={quote}
      lead={lead}
      leadRecord={leadRecord}
      profiles={profileMap}
      client={client}
      preEvent={preEvent}
      paymentLinks={paymentLinks}
      emailDeliveries={emailDeliveries}
      manualDeliveries={manualDeliveries}
      canViewFinance={canViewFinance}
      canManageFinanceSheet={canManageFinanceSheet}
      canViewInvoices={canViewInvoices}
      canManageInvoices={canManageInvoices}
      invoices={invoices}
      financialSheetDraft={financialSheetDraft}
    />
  );
}
