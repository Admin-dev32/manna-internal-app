import { EventsList } from '@/components/events/events-list';
import { requirePermission } from '@/lib/auth/guards';
import { getEventsOverviewPageData } from '@/services/events/queries';

export default async function EventosPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; from?: string; to?: string; view?: string; month?: string }>;
}) {
  await requirePermission('events.view');

  const resolvedSearchParams = await searchParams;
  const requestedView = resolvedSearchParams?.view === 'calendar' ? 'calendar' : 'list';
  const requestedMonth = /^\d{4}-\d{2}$/.test(String(resolvedSearchParams?.month ?? ''))
    ? String(resolvedSearchParams?.month)
    : new Date().toISOString().slice(0, 7);
  const [year, month] = requestedMonth.split('-').map(Number);
  const monthStart = `${requestedMonth}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const filters = {
    status: resolvedSearchParams?.status ?? 'todos',
    from: resolvedSearchParams?.from ?? (requestedView === 'calendar' ? monthStart : ''),
    to: resolvedSearchParams?.to ?? (requestedView === 'calendar' ? monthEnd : ''),
  };
  const { events, clients, quotes, checklistProgressByEvent } = await getEventsOverviewPageData(filters);

  return (
    <EventsList
      events={events}
      clients={clients}
      quotes={quotes}
      checklistProgressByEvent={checklistProgressByEvent}
      filters={filters}
      view={requestedView}
      month={requestedMonth}
    />
  );
}
