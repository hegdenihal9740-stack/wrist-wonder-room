import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WatchTone } from '@/lib/watches';

export type Stock = Partial<Record<WatchTone, number>>;
export async function loadStock(): Promise<Stock> {
  const { data } = await supabase.from('inventory').select('watch_id, stock');
  return Object.fromEntries((data ?? []).map((r) => [r.watch_id, r.stock])) as Stock;
}
export function useStock() {
  const [s, setS] = useState<Stock | null>(null);
  useEffect(() => { let on = true; void loadStock().then((v) => { if (on) setS(v); }); return () => { on = false; }; }, []);
  return s;
}
export const stockLabel = (n: number | undefined) => n === undefined ? '' : n <= 0 ? 'Out of stock' : n <= 3 ? `Only ${n} left` : 'In stock';
