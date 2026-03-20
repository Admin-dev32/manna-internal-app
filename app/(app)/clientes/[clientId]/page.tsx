import { ClientDetail } from '@/components/clients/client-detail';
import { getClientDetailPageData } from '@/services/clients/queries';
import { getPreEventByClientId } from '@/services/pre-events/queries';

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const [{ client, profileMap }, preEvent] = await Promise.all([getClientDetailPageData(clientId), getPreEventByClientId(clientId)]);

  return <ClientDetail client={client} profiles={profileMap} preEvent={preEvent} />;
}
