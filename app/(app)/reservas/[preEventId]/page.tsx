import { PreEventDetail } from '@/components/pre-events/pre-event-detail';
import { getPreEventDetailPageData } from '@/services/pre-events/queries';

export default async function PreEventDetailPage({ params }: { params: Promise<{ preEventId: string }> }) {
  const { preEventId } = await params;
  const { client, lead, preEvent, profiles, quote } = await getPreEventDetailPageData(preEventId);

  return <PreEventDetail preEvent={preEvent} client={client} lead={lead} quote={quote} profiles={profiles} />;
}
