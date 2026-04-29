import { hasPermission } from '@/lib/auth/permissions';
import { buildGLReportsDataset, type GLReportFilters } from '@/lib/finance/gl-reports';
import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getGLReportsDataset(filters: GLReportFilters = {}) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return buildGLReportsDataset([], [], [], filters);

  const canViewGL = hasPermission(session.user, 'finance.view')
    || (session.user.permissions as string[]).includes('finance.ledger.view')
    || (session.user.permissions as string[]).includes('finance.accounts.view');

  if (!canViewGL) return buildGLReportsDataset([], [], [], filters);

  const { data: entriesData } = await supabase
    .from('journal_entries')
    .select('id, entry_date, status, source_type, source_id')
    .eq('status', 'posted')
    .order('entry_date', { ascending: false })
    .limit(3000);

  const entries = (entriesData ?? []) as Array<{
    id: string;
    entry_date: string;
    status: 'draft' | 'posted' | 'reversed';
    source_type: string;
    source_id: string;
  }>;

  if (entries.length === 0) return buildGLReportsDataset([], [], [], filters);

  const entryIds = entries.map((entry) => entry.id);

  const [{ data: linesData }, { data: accountsData }] = await Promise.all([
    supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, debit, credit, memo, entity_type, entity_id')
      .in('journal_entry_id', entryIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type, normal_balance')
      .order('code', { ascending: true }),
  ]);

  return buildGLReportsDataset(
    entries,
    (linesData ?? []) as Array<{
      id: string;
      journal_entry_id: string;
      account_id: string;
      debit: number | string;
      credit: number | string;
      memo: string | null;
      entity_type: string | null;
      entity_id: string | null;
    }>,
    (accountsData ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      account_type: string;
      normal_balance: 'debit' | 'credit';
    }>,
    filters,
  );
}
