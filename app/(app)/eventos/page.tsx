import { EventsList } from '@/components/events/events-list';
import { requirePermission } from '@/lib/auth/guards';
import { getEventsOverviewPageData } from '@/services/events/queries';

export default async function EventosPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  await requirePermission('events.view');

  const resolvedSearchParams = await searchParams;
  const filters = {
    status: resolvedSearchParams?.status ?? 'todos',
    from: resolvedSearchParams?.from ?? '',
    to: resolvedSearchParams?.to ?? '',
  };
  const { events, clients, quotes, checklistProgressByEvent } = await getEventsOverviewPageData(filters);

  return <EventsList events={events} clients={clients} quotes={quotes} checklistProgressByEvent={checklistProgressByEvent} filters={filters} />;
}
