import { CommunicationHub } from '@/components/communication/communication-hub';
import { requirePermission } from '@/lib/auth/guards';
import { getCommunicationHubData, type CommunicationHubFilters } from '@/services/internal-communication/queries';
import type { InternalCommentEntityType } from '@/types/internal-communication';

const allowedModules = new Set<InternalCommentEntityType>(['lead', 'quote', 'client', 'pre_event', 'event', 'event_task']);
const allowedChannels = new Set<CommunicationHubFilters['channel']>(['all', 'mentions']);
const allowedTimeframes = new Set<CommunicationHubFilters['timeframe']>(['all', '24h', '7d']);

function normalizeFilters(raw: { module?: string; channel?: string; timeframe?: string }): CommunicationHubFilters {
  const module = raw.module && raw.module !== 'all' && allowedModules.has(raw.module as InternalCommentEntityType) ? (raw.module as InternalCommentEntityType) : 'all';
  const channel = raw.channel && allowedChannels.has(raw.channel as CommunicationHubFilters['channel']) ? (raw.channel as CommunicationHubFilters['channel']) : 'all';
  const timeframe = raw.timeframe && allowedTimeframes.has(raw.timeframe as CommunicationHubFilters['timeframe']) ? (raw.timeframe as CommunicationHubFilters['timeframe']) : 'all';
  return { module, channel, timeframe };
}

export default async function ComunicacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string; channel?: string; timeframe?: string }>;
}) {
  await requirePermission('communication.view');
  const resolvedSearchParams = await searchParams;
  const filters = normalizeFilters(resolvedSearchParams ?? {});
  const entries = await getCommunicationHubData(filters);

  return <CommunicationHub entries={entries} filters={filters} />;
}
