import { QuoteDetail } from '@/components/quotes/quote-detail';
import { getQuoteDetailPageData } from '@/services/quotes/queries';

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { client, lead, preEvent, profileMap, quote } = await getQuoteDetailPageData(quoteId);

  return <QuoteDetail quote={quote} lead={lead} profiles={profileMap} client={client} preEvent={preEvent} />;
}
