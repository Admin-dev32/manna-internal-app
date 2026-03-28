import { QuoteDetail } from '@/components/quotes/quote-detail';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionContext } from '@/services/auth/session';
import { getQuoteFinancialSheetDraft } from '@/services/finance/queries';
import { getQuoteDetailPageData } from '@/services/quotes/queries';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const [{ client, lead, preEvent, profileMap, quote }, session] = await Promise.all([getQuoteDetailPageData(quoteId), getSessionContext()]);
  const canViewFinance = Boolean(session.user && hasPermission(session.user, 'finance.view'));
  const financialSheetDraft = canViewFinance ? await getQuoteFinancialSheetDraft(quote) : null;

  return (
    <QuoteDetail
      quote={quote}
      lead={lead}
      profiles={profileMap}
      client={client}
      preEvent={preEvent}
      canViewFinance={canViewFinance}
      financialSheetDraft={financialSheetDraft}
    />
  );
}
