import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { buildSalesTaxSupportDataset, type SalesTaxReportFilters } from '@/lib/finance/sales-tax-report';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getSalesTaxSupportDataset(filters: SalesTaxReportFilters = {}) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return buildSalesTaxSupportDataset([], filters);

  const canViewTax = hasPermission(session.user, 'finance.view')
    || (session.user.permissions as string[]).includes('finance.tax.view')
    || (session.user.permissions as string[]).includes('finance.accounts.view');

  if (!canViewTax) return buildSalesTaxSupportDataset([], filters);

  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, taxable_amount, non_taxable_amount, tax_rate, tax_amount, total_amount, tax_jurisdiction, tax_region, tax_exemption_reason, issued_at, created_at')
    .order('created_at', { ascending: false })
    .limit(3000);

  return buildSalesTaxSupportDataset(
    (data ?? []) as Array<{
      id: string;
      invoice_number: string;
      status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
      taxable_amount: number | string;
      non_taxable_amount: number | string;
      tax_rate: number | string;
      tax_amount: number | string;
      total_amount: number | string;
      tax_jurisdiction: string | null;
      tax_region: string | null;
      tax_exemption_reason: string | null;
      issued_at: string | null;
      created_at: string;
    }>,
    filters,
  );
}
