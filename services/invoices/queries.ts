import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InvoiceRecord } from '@/types/invoices';

export async function getInvoicesByQuoteId(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InvoiceRecord[];

  const { data } = await supabase.from('invoices').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false });
  return (data ?? []) as InvoiceRecord[];
}

export async function getLatestInvoiceByQuoteId(quoteId: string) {
  const invoices = await getInvoicesByQuoteId(quoteId);
  return invoices[0] ?? null;
}
