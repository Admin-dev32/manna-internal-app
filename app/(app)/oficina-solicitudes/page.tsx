import { MainOfficeInbox } from '@/components/internal-tickets/main-office-inbox';
import { requirePermission } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMainOfficeTickets } from '@/services/internal-tickets/queries';
import type { InternalTicketStatus } from '@/types/internal-tickets';

const allowedStatuses = new Set<InternalTicketStatus>(['open', 'in_progress', 'closed']);

function normalizeStatus(raw: string | undefined): 'all' | InternalTicketStatus {
  if (!raw || raw === 'all') return 'all';
  return allowedStatuses.has(raw as InternalTicketStatus) ? (raw as InternalTicketStatus) : 'all';
}

export default async function OficinaSolicitudesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requirePermission('internal_tickets.manage');
  const params = await searchParams;
  const status = normalizeStatus(params?.status);

  const [tickets, supabase] = await Promise.all([
    getMainOfficeTickets({ status }),
    createSupabaseServerClient(),
  ]);

  const { data: profilesData } = supabase
    ? await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name', { ascending: true })
    : { data: [] };

  const assignableProfiles = ((profilesData ?? []) as Array<{ id: string; full_name: string | null }>);

  return <MainOfficeInbox tickets={tickets} statusFilter={status} assignableProfiles={assignableProfiles} />;
}
