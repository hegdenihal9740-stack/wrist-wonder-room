import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomer } from '@/components/CustomerAccounts';
import { ShopHeader } from '@/components/ShopHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { COURIERS, STATUS_LABELS, STATUSES, fromRow, trackingLink, type Order, type OrderRow } from '@/lib/orders';
import { watches } from '@/lib/watches';
import { ProductManager } from '@/components/ProductManager';

export const Route = createFileRoute('/seller')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Seller dashboard — Private Flight' }, { name: 'description', content: 'Manage Private Flight orders, statuses and tracking.' }, { property: 'og:title', content: 'Seller dashboard — Private Flight' }, { property: 'og:description', content: 'Store owner order management.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: SellerPage,
});

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ALL = [...STATUSES, 'cancelled'] as string[];
const db = supabase as any;

function SellerPage() {
  const { user, ready } = useCustomer();
  const [role, setRole] = useState<'loading' | 'admin' | 'none' | 'taken'>('loading');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'orders' | 'products'>('orders');

  async function checkRole() {
    if (!user) return;
    const { data } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (data) { setRole('admin'); return; }
    const { data: owned } = await db.rpc('store_has_owner');
    setRole(owned ? 'taken' : 'none');
  }
  async function load() {
    const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
    if (error) setErr('Could not load orders.'); else setOrders((data as OrderRow[]).map(fromRow));
  }
  useEffect(() => { void checkRole(); }, [user?.id]);
  useEffect(() => { if (role === 'admin') void load(); }, [role]);

  async function claim() {
    const { data, error } = await db.rpc('claim_store_owner');
    if (error || !data) setErr('Could not claim the store.'); else setRole('admin');
  }

  const shown = useMemo(() => orders.filter((o) => (filter === 'all' || (o.status ?? 'confirmed') === filter) && (!q || `${o.id} ${o.address?.name} ${o.address?.mobile}`.toLowerCase().includes(q.toLowerCase()))), [orders, filter, q]);
  const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const count = (s: string) => orders.filter((o) => (o.status ?? 'confirmed') === s).length;

  let body;
  if (!ready || (user && role === 'loading')) body = <p>Loading…</p>;
  else if (!user) body = <p>Please <Link to="/auth" className="underline">sign in</Link> to open the seller dashboard.</p>;
  else if (role === 'none') body = <div className="space-y-3"><p>This store has no owner yet. Claim it to manage orders.</p><Button onClick={claim}>Claim store ownership</Button></div>;
  else if (role === 'taken') body = <p>This page is only for the store owner.</p>;
  else body = <>
    <div className="flex gap-2"><Button variant={tab === 'orders' ? 'default' : 'outline'} onClick={() => setTab('orders')}>Orders</Button><Button variant={tab === 'products' ? 'default' : 'outline'} onClick={() => setTab('products')}>Products</Button></div>
    {tab === 'products' ? <ProductManager /> : <>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[['Revenue', inr(revenue)], ['To pack', count('confirmed')], ['In transit', count('shipped') + count('out_for_delivery') + count('packed')], ['Delivered', count('delivered')]].map(([k, v]) => <div key={k} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-semibold">{v}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-2">{['all', ...ALL].map((s) => <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : STATUS_LABELS[s]}</Button>)}</div>
    <Input placeholder="Search order ID, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
    {shown.length === 0 ? <p className="text-muted-foreground">No orders.</p> : shown.map((o) => <OrderCard key={o.id} order={o} onSaved={load} />)}
    </>}
  </>;

  return <main className="shop-page acc-page"><ShopHeader /><div className="acc-wrap space-y-4"><h1 className="acc-h">Seller dashboard</h1>{err && <p role="alert" className="text-destructive">{err}</p>}{body}</div></main>;
}

function OrderCard({ order: o, onSaved }: { order: Order; onSaved: () => void }) {
  const [status, setStatus] = useState(o.status ?? 'confirmed');
  const [courier, setCourier] = useState(o.courier ?? '');
  const [awb, setAwb] = useState(o.awb ?? '');
  const [url, setUrl] = useState(o.trackingUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function save() {
    setBusy(true); setMsg('');
    if (status === 'cancelled' && o.status !== 'cancelled') {
      if (!confirm('Cancel this order? Stock will be returned.')) { setBusy(false); return; }
      const { data, error } = await db.rpc('cancel_order', { _order_id: o.id });
      setBusy(false);
      if (error || !data) setMsg('Cancel failed.'); else { setMsg('Cancelled.'); onSaved(); }
      return;
    }
    const { error } = await db.from('orders').update({ status, courier: courier || null, awb: awb.trim() || null, tracking_url: url.trim() || null }).eq('id', o.id);
    setBusy(false);
    if (error) setMsg('Save failed.'); else { setMsg('Saved.'); onSaved(); }
  }
  const link = trackingLink({ courier, awb, trackingUrl: url });
  return <article className="acc-card space-y-2">
    <div className="flex flex-wrap justify-between gap-2"><b>#{o.id}</b><span className="text-sm text-muted-foreground">{new Date(o.placedAt).toLocaleString('en-IN')}</span></div>
    <p className="text-sm">{o.items.map((l) => `${watches.find((w) => w.id === l.id)?.name ?? l.id} × ${l.qty}`).join(', ')} · <b>{inr(o.total)}</b> · {o.payment === 'cod' ? 'Cash on delivery' : o.payment}</p>
    {o.address && <p className="text-sm text-muted-foreground">{o.address.name}, {o.address.address}, {o.address.city}, {o.address.state} — {o.address.pincode} · {o.address.mobile}</p>}
    <div className="grid gap-2 sm:grid-cols-3">
      <select className="rounded-md border border-input bg-background p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">{ALL.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
      <select className="rounded-md border border-input bg-background p-2 text-sm" value={courier} onChange={(e) => setCourier(e.target.value)} aria-label="Courier"><option value="">Courier…</option>{Object.keys(COURIERS).map((c) => <option key={c}>{c}</option>)}</select>
      <Input placeholder="Tracking / AWB number" value={awb} onChange={(e) => setAwb(e.target.value)} />
    </div>
    {courier === 'Other' && <Input placeholder="Tracking link (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />}
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>{link && <a className="text-sm underline" href={link} target="_blank" rel="noreferrer">Track ↗</a>}<Link to="/invoice/$orderId" params={{ orderId: o.id }} className="text-sm underline">Invoice</Link>{msg && <span className="text-sm">{msg}</span>}</div>
  </article>;
}
