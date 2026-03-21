import { EventsList } from '@/components/events/events-list';
import { getEventsOverviewPageData } from '@/services/events/queries';

export default async function EventosPage() {
  const { events, clients, quotes } = await getEventsOverviewPageData();

  return <EventsList events={events} clients={clients} quotes={quotes} />;
}
