import { supabase } from '@/integrations/supabase/client';
import type { WatchTone } from '@/lib/watches';

export type OrderLine = { id: WatchTone; qty: number; price: number };
export type OrderAddress = { name: string; mobile: string; address: string; locality?: string; city: string; state: string; pincode: string; landmark?: string; type?: string };
export type Order = { id: string; items: OrderLine[]; total: number; payment: string; placedAt: string; address: OrderAddress; status?: string; courier?: string | null; awb?: string | null; trackingUrl?: string | null; codConfirmed?: boolean };
export const STATUSES = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'] as const;
export const STATUS_LABELS: Record<string, string> = { confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
export const COURIERS: Record<string, string> = { Delhivery: 'https://www.delhivery.com/track/package/{awb}', 'Blue Dart': 'https://www.bluedart.com/tracking?trackFor=0&trackNo={awb}', DTDC: 'https://www.dtdc.in/trace.asp?cnno={awb}', 'India Post': 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx', Shiprocket: 'https://shiprocket.co/tracking/{awb}', Other: '' };
export const trackingLink = (o: Pick<Order, 'courier' | 'awb' | 'trackingUrl'>) => o.trackingUrl || (o.courier && o.awb && COURIERS[o.courier] ? COURIERS[o.courier]!.replace('{awb}', encodeURIComponent(o.awb)) : '');
export type OrderRow = { id: string; items: unknown; total: number; payment: string; created_at: string; address: unknown; status: string; courier: string | null; awb: string | null; tracking_url: string | null; cod_confirmed: boolean };
export const fromRow = (r: OrderRow): Order => ({ id: r.id, items: r.items as OrderLine[], total: r.total, payment: r.payment, placedAt: r.created_at, address: r.address as OrderAddress, status: r.status, courier: r.courier, awb: r.awb, trackingUrl: r.tracking_url, codConfirmed: r.cod_confirmed });

const KEY = 'pf-orders';

type Legacy = Partial<Order> & { item?: WatchTone; qty?: number; price?: number };
const normalize = (o: Legacy): Order => ({
  id: o.id ?? '',
  items: o.items ?? (o.item ? [{ id: o.item, qty: o.qty ?? 1, price: (o.price ?? 0) / (o.qty ?? 1) }] : []),
  total: o.total ?? o.price ?? 0,
  payment: o.payment ?? 'cod',
  placedAt: o.placedAt ?? new Date().toISOString(),
  address: o.address as OrderAddress,
});

const readLocal = (): Order[] => { try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as Legacy[]).map(normalize); } catch { return []; } };

export async function saveOrder(o: Order) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Please sign in to place your order');
  const { error } = await supabase.from('orders').insert({ id: o.id, user_id: data.user.id, items: o.items, total: o.total, payment: o.payment, address: o.address });
  if (error) throw new Error(error.message.includes('OUT_OF_STOCK') ? 'Sorry, one of these watches just went out of stock' : 'Could not place your order, please try again');
}

export async function loadOrders(): Promise<Order[]> {
  const local = readLocal();
  const { data: u } = await supabase.auth.getUser();
  let remote: Order[] = [];
  if (u.user) {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    remote = ((data ?? []) as OrderRow[]).filter((r) => r.id && (r as unknown as { user_id: string }).user_id === u.user!.id).map(fromRow);
  }
  const seen = new Set(remote.map((r) => r.id));
  return [...remote, ...local.filter((l) => !seen.has(l.id)).reverse()].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export function orderStatus(o: Pick<Order, 'status' | 'placedAt'>) {
  const steps = STATUSES.map((k) => STATUS_LABELS[k]!);
  if (o.status === 'cancelled') return { steps, index: -1, cancelled: true };
  const i = STATUSES.indexOf((o.status ?? 'confirmed') as typeof STATUSES[number]);
  return { steps, index: i < 0 ? 0 : i, cancelled: false };
}
