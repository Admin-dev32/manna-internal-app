import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PaymentLinkRecord, PaymentMode, PaymentSourceRecordType } from '@/types/payments';

export async function getPaymentLinksBySource(sourceRecordType: PaymentSourceRecordType, sourceRecordId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as PaymentLinkRecord[];

  const { data } = await supabase
    .from('payment_links')
    .select('*')
    .eq('source_record_type', sourceRecordType)
    .eq('source_record_id', sourceRecordId)
    .order('created_at', { ascending: false });

  return (data ?? []) as PaymentLinkRecord[];
}

export async function getLatestPaymentLinkBySourceAndMode(sourceRecordType: PaymentSourceRecordType, sourceRecordId: string, mode: PaymentMode) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('payment_links')
    .select('*')
    .eq('source_record_type', sourceRecordType)
    .eq('source_record_id', sourceRecordId)
    .eq('payment_mode', mode)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PaymentLinkRecord | null) ?? null;
}
