import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronRight, Heart, Package, UserRound, ArrowLeft, Trash2 } from 'lucide-react';
import { ShopHeader } from '@/components/ShopHeader';
import { useCustomer } from '@/components/CustomerAccounts';
import { cart, prices } from '@/lib/cart';
import { useWishlist, wishlist } from '@/lib/wishlist';
import { watches } from '@/lib/watches';
import { loadOrders, orderStatus, trackingLink, type Order } from '@/lib/orders';
import { supabase } from '@/integrations/supabase/client';
const usd = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const Route = createFileRoute('/account')({
  ssr: false,
  head: () => ({ meta: [{ title: 'My Account — Private Flight Store' }, { name: 'description', content: 'Your profile, orders and wishlist at Private Flight.' }, { property: 'og:title', content: 'My Account — Private Flight Store' }, { property: 'og:description', content: 'Your profile, orders and wishlist.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useCustomer();
  const [tab, setTab] = useState<'home' | 'orders' | 'wishlist'>('home');
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const wish = useWishlist();
  useEffect(() => { let on = true; void loadOrders().then((o) => { if (on) setOrders(o); }).catch(() => {}); return () => { on = false; }; }, [user?.id]);
  const name = String(user?.user_metadata?.['full_name'] ?? user?.user_metadata?.['display_name'] ?? (() => { try { return JSON.parse(localStorage.getItem('pf-customer') ?? 'null')?.name; } catch { return null; } })() ?? 'Guest');
  const back = <button type="button" className="acc-back" onClick={() => { setTab('home'); setOpen(null); }}><ArrowLeft size={16} /> Account</button>;

  return <main className="shop-page acc-page">
    <ShopHeader />
    <div className="acc-wrap">
      {tab === 'home' && <>
        <section className="acc-card acc-profile">
          <span className="acc-avatar"><UserRound size={28} /></span>
          <div><p className="acc-hello">Hello, {name.split(' ')[0]}</p><p className="fk-muted">{user?.email ?? 'Sign in to sync your account'}</p></div>
          <Link to="/auth" className="acc-edit">{user ? 'Edit profile' : 'Login'}</Link>
        </section>
        <div className="acc-quick">
          <button type="button" className="acc-card acc-tile" onClick={() => setTab('orders')}><Package size={22} /><span>Orders</span><b>{orders.length}</b></button>
          <button type="button" className="acc-card acc-tile" onClick={() => setTab('wishlist')}><Heart size={22} /><span>Wishlist</span><b>{wish.length}</b></button>
        </div>
        <section className="acc-card acc-list">
          <button type="button" onClick={() => setTab('orders')}><Package size={18} /> My orders <ChevronRight size={16} /></button>
          <button type="button" onClick={() => setTab('wishlist')}><Heart size={18} /> My wishlist <ChevronRight size={16} /></button>
          <Link to="/auth"><UserRound size={18} /> Profile information <ChevronRight size={16} /></Link>
          <Link to="/shipping-policy"><Package size={18} /> Shipping policy <ChevronRight size={16} /></Link>
          <Link to="/returns"><Package size={18} /> Returns &amp; refunds <ChevronRight size={16} /></Link>
          <Link to="/contact"><UserRound size={18} /> Contact us <ChevronRight size={16} /></Link>
          {user && <Link to="/seller"><Package size={18} /> Seller dashboard <ChevronRight size={16} /></Link>}
        </section>
      </>}

      {tab === 'orders' && <>{back}<h2 className="acc-h">My orders</h2>
        {orders.length === 0 ? <p className="acc-card fk-muted">No orders yet.</p> : orders.map((o) => {
          const ws = o.items.map((l) => ({ ...l, w: watches.find((x) => x.id === l.id)! })).filter((l) => l.w);
          const placed = new Date(o.placedAt);
          const by = new Date(placed.getTime() + 3 * 86400000);
          const { steps, index, cancelled } = orderStatus(o);
          const link = trackingLink(o);
          const delivered = index === steps.length - 1;
          const qty = o.items.reduce((s, l) => s + l.qty, 0);
          const title = ws.length === 1 ? ws[0]!.w.name : `${ws[0]?.w.name ?? 'Order'} + ${ws.length - 1} more`;
          return <article key={o.id} className="acc-card acc-order">
            <button type="button" className="acc-order-row" onClick={() => setOpen(open === o.id ? null : o.id)}>
              <span className="acc-order-thumbs">{ws.slice(0, 3).map((l) => <img key={l.id} src={l.w.image} alt={l.w.name} />)}</span>
              <div><p className="acc-order-name">{title}</p><p className={delivered ? 'fk-delivery-free' : 'acc-status'}>● {cancelled ? 'Cancelled' : delivered ? 'Delivered' : `${steps[index]} · Expected by ${fmt(by)}`}</p></div>
              <ChevronRight size={18} />
            </button>
            {(o.courier || o.awb) && <p className="fk-muted">{o.courier} · AWB {o.awb} {link && <a href={link} target="_blank" rel="noreferrer">Track parcel ↗</a>}</p>}
            {!cancelled && <ol className="trk" aria-label={`Order status: ${steps[index]}`}>
              {steps.map((s, i) => <li key={s} className={`trk-step${i <= index ? ' done' : ''}${i === index ? ' current' : ''}`}><span className="trk-dot">{i <= index ? '✓' : i + 1}</span>{s}</li>)}
            </ol>}
            {open === o.id && <>
              <div className="acc-lines">{ws.map((l) => <div key={l.id} className="acc-line"><img src={l.w.image} alt="" /><span>{l.w.name} × {l.qty}</span><span>{usd(l.price * l.qty)}</span></div>)}</div>
              <dl className="acc-details">
                <div><dt>Order ID</dt><dd>{o.id}</dd></div>
                <div><dt>Ordered on</dt><dd>{fmt(placed)}</dd></div>
                <div><dt>Items</dt><dd>{qty}</dd></div>
                <div><dt>Total</dt><dd>{usd(o.total)}</dd></div>
                <div><dt>Payment</dt><dd>{o.payment === 'cod' ? 'Cash on delivery' : o.payment}</dd></div>
                {o.address && <div><dt>Ship to</dt><dd>{o.address.name}, {o.address.address}, {o.address.city}, {o.address.state} — {o.address.pincode} · {o.address.mobile}</dd></div>}
              </dl><Link to="/invoice/$orderId" params={{ orderId: o.id }} className="co-change">View / print invoice</Link></>}
            {!cancelled && index <= 1 && <button type="button" className="co-change text-destructive" onClick={async () => {
              if (!confirm('Cancel this order?')) return;
              const { data, error } = await (supabase as any).rpc('cancel_order', { _order_id: o.id });
              if (error || !data) { alert('This order can no longer be cancelled.'); return; }
              setOrders((all) => all.map((x) => x.id === o.id ? { ...x, status: 'cancelled' } : x));
            }}>Cancel order</button>}
          </article>;
        })}</>}

      {tab === 'wishlist' && <>{back}<h2 className="acc-h">My wishlist ({wish.length})</h2>
        {wish.length === 0 ? <p className="acc-card fk-muted">Your wishlist is empty. Tap the heart on any watch to save it.</p> : wish.map((id) => {
          const w = watches.find((x) => x.id === id)!;
          return <article key={id} className="acc-card acc-order"><div className="acc-order-row">
            <Link to="/shop/$watchId" params={{ watchId: id }}><img src={w.image} alt={w.name} /></Link>
            <div><p className="acc-order-name">{w.name}</p><p className="fk-price">{usd(prices[id])}</p>
              <button type="button" className="fk-cart acc-move" onClick={() => { cart.add(id); wishlist.remove(id); }}>Move to cart</button></div>
            <button type="button" aria-label="Remove" onClick={() => wishlist.remove(id)}><Trash2 size={18} /></button>
          </div></article>;
        })}</>}
    </div>
  </main>;
}
