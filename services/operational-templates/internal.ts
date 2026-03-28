import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InventoryItemRecord } from '@/types/inventory';

export async function getInventoryItemByIdForTemplates(itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('inventory_items').select('*').eq('id', itemId).maybeSingle();
  return (data as InventoryItemRecord | null) ?? null;
}
