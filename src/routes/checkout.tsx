import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ShopHeader } from '@/components/ShopHeader';
import { cart, prices, useCart } from '@/lib/cart';
import { saveOrder, type OrderLine } from '@/lib/orders';
import { watches, type WatchTone } from '@/lib/watches';
import { useCustomer } from '@/components/CustomerAccounts';
import { useStock } from '@/lib/inventory';

type Address = { name: string; mobile: string; pincode: string; locality: string; address: string; city: string; state: string; landmark: string; type: 'Home' | 'Work' };
const EMPTY: Address = { name: '', mobile: '', pincode: '', locality: '', address: '', city: '', state: '', landmark: '', type: 'Home' };
const KEY = 'private-flight-address';
const usd = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const Route = createFileRoute('/checkout')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { item?: WatchTone } => (watches.some((w) => w.id === s['item']) ? { item: s['item'] as WatchTone } : {}),
  head: () => ({ meta: [{ title: 'Checkout — Private Flight Store' }, { name: 'description', content: 'Add your delivery address and place your watch order.' }, { property: 'og:title', content: 'Checkout — Private Flight Store' }, { property: 'og:description', content: 'Add your delivery address and place your watch order.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: Checkout,
});

function Checkout() {
  const { item } = Route.useSearch();
  const fromCart = !item;
  const c = useCart();
  const [single, setSingle] = useState(1);
  const lines: { id: WatchTone; qty: number }[] = fromCart ? c.items : [{ id: item, qty: single }];
  const setQty = (id: WatchTone, q: number) => { if (fromCart) cart.setQty(id, q); else setSingle(Math.max(1, q)); };
  const [a, setA] = useState<Address>(EMPTY);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [placed, setPlaced] = useState<{ id: string; total: number; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const { user, ready } = useCustomer();
  const stock = useStock();
  const [codOk, setCodOk] = useState(false);
  const short = stock ? lines.filter((l) => (stock[l.id] ?? 0) < l.qty) : [];
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setA(JSON.parse(r) as Address); } catch { /* ignore */ } }, []);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setA({ ...a, [k]: e.target.value });
  const saveAddress = () => {
    if (!a.name.trim() || !/^[6-9]\d{9}$/.test(a.mobile) || !/^\d{6}$/.test(a.pincode) || !a.address.trim() || !a.city.trim() || !a.state.trim()) { toast.error('Fill name, 10-digit mobile, 6-digit pincode, address, city and state'); return; }
    localStorage.setItem(KEY, JSON.stringify(a)); setStep(2);
  };
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * prices[l.id], 0);

  const placeOrder = async () => {
    if (lines.length === 0) { toast.error('Your cart is empty'); return; }
    if (!user) { toast.error('Please sign in to place your order'); return; }
    if (short.length) { toast.error('Some watches are out of stock — reduce the quantity'); return; }
    if (!codOk) { toast.error('Please confirm you will answer our confirmation call'); return; }
    setBusy(true);
    const id = `PF${Date.now().toString(36).toUpperCase()}`;
    const items: OrderLine[] = lines.map((l) => ({ id: l.id, qty: l.qty, price: prices[l.id] }));
    try {
      await saveOrder({ id, items, total, payment: 'cod', placedAt: new Date().toISOString(), address: a });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not place order'); setBusy(false); return; }
    if (fromCart) cart.clear();
    setPlaced({ id, total, count });
    setBusy(false);
    toast.success('Order placed!', { icon: <CheckCircle2 /> });
  };

  if (!placed && lines.length === 0) return <main className="shop-page">
    <ShopHeader />
    <div className="co-grid"><section className="co-step"><h2>Your cart is empty</h2><p className="fk-muted">Add a watch to your cart to check out.</p>
      <Link to="/collection" className="fk-buy co-continue">Browse watches</Link></section></div>
  </main>;

  return <main className="shop-page">
    <ShopHeader />
    <div className="co-grid">
      <div className="co-steps">
        <section className="co-step">
          <h2><span>1</span> Delivery address</h2>
          {step === 1 ? <div className="co-form">
            <input className="shop-input" placeholder="Full name" value={a.name} onChange={set('name')} />
            <input className="shop-input" placeholder="10-digit mobile number" inputMode="numeric" maxLength={10} value={a.mobile} onChange={(e) => setA({ ...a, mobile: e.target.value.replace(/\D/g, '') })} />
            <input className="shop-input" placeholder="Pincode" inputMode="numeric" maxLength={6} value={a.pincode} onChange={(e) => setA({ ...a, pincode: e.target.value.replace(/\D/g, '') })} />
            <input className="shop-input" placeholder="Locality" value={a.locality} onChange={set('locality')} />
            <textarea className="shop-input co-wide" rows={3} placeholder="Address (house no, building, street, area)" value={a.address} onChange={set('address')} />
            <input className="shop-input" placeholder="City / District / Town" value={a.city} onChange={set('city')} />
            <input className="shop-input" placeholder="State" value={a.state} onChange={set('state')} />
            <input className="shop-input co-wide" placeholder="Landmark (optional)" value={a.landmark} onChange={set('landmark')} />
            <div className="co-type co-wide">Address type
              {(['Home', 'Work'] as const).map((t) => <label key={t}><input type="radio" checked={a.type === t} onChange={() => setA({ ...a, type: t })} /> {t}</label>)}
            </div>
            <button type="button" className="fk-buy co-wide" onClick={saveAddress}>Save and deliver here</button>
          </div> : <div className="co-summary-line"><MapPin size={16} /><p><b>{a.name}</b> <span className="co-tag">{a.type}</span> {a.mobile}<br />{a.address}, {a.locality && `${a.locality}, `}{a.city}, {a.state} — <b>{a.pincode}</b></p>{!placed && <button type="button" className="co-change" onClick={() => setStep(1)}>Change</button>}</div>}
        </section>
        <section className="co-step">
          <h2><span>2</span> Order summary</h2>
          {step >= 2 && !placed && <div className="co-items">
            {lines.map((l) => {
              const w = watches.find((x) => x.id === l.id)!;
              return <div key={l.id} className="co-item">
                <img src={w.image} alt={w.name} />
                <div><p className="fk-title co-item-name">{w.name}</p><p className="fk-muted">{w.finish}</p><p className="fk-price">{usd(prices[l.id])}</p>
                  <div className="co-qty"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.id, fromCart ? l.qty - 1 : l.qty - 1)}>−</button><span>{l.qty}</span><button type="button" aria-label="Increase quantity" onClick={() => setQty(l.id, l.qty + 1)}>+</button>
                    {fromCart && <button type="button" aria-label={`Remove ${w.name}`} onClick={() => cart.setQty(l.id, 0)}><Trash2 size={14} /></button>}</div></div>
                {stock && (stock[l.id] ?? 0) < l.qty && <p className="fk-pin-msg is-err">{(stock[l.id] ?? 0) <= 0 ? 'Out of stock' : `Only ${stock[l.id]} left`}</p>}<span className="co-item-sub">{usd(prices[l.id] * l.qty)}</span>
              </div>;
            })}
            {step === 2 && <button type="button" className="fk-buy co-continue" onClick={() => setStep(3)}>Continue</button>}
          </div>}
        </section>
        <section className="co-step">
          <h2><span>3</span> Payment</h2>
          {step === 3 && !placed && <div className="co-pay">
            <label><input type="radio" checked readOnly /> Cash on delivery — pay when your watch arrives</label>
            <label className="fk-muted"><input type="radio" disabled /> UPI / Card / Net banking — coming soon</label>
            <label><input type="checkbox" checked={codOk} onChange={(e) => setCodOk(e.target.checked)} /> I will answer a confirmation call on {a.mobile} before dispatch</label>
            {ready && !user && <p className="fk-pin-msg is-err">Please <Link to="/auth">sign in</Link> to place your order so you can track it.</p>}
            <button type="button" className="fk-buy" disabled={busy || !user || short.length > 0} onClick={() => void placeOrder()}>{busy ? 'Placing order…' : `Place order · ${usd(total)}`}</button>
          </div>}
          {placed && <div className="co-pay">
            <p><CheckCircle2 size={18} className="fk-delivery-free" /> <b>Order confirmed!</b></p>
            <p>Order ID: <b>{placed.id}</b></p>
            <p>Pay <b>{usd(placed.total)}</b> in cash when your {placed.count > 1 ? `${placed.count} watches arrive` : 'watch arrives'} in {a.city}. We will call {a.mobile} to confirm before dispatch. Estimated delivery: 3–5 business days.</p>
            <Link to="/invoice/$orderId" params={{ orderId: placed.id }} className="co-change">View / print invoice</Link>
            <Link to="/account" className="fk-buy co-continue">Track my order</Link>
            <Link to="/collection" className="co-change">Continue shopping</Link>
          </div>}
        </section>
      </div>
      {!placed && <aside className="co-price">
        <h3>Price details</h3>
        {lines.map((l) => { const w = watches.find((x) => x.id === l.id)!; return <div key={l.id}><span>{w.name} × {l.qty}</span><span>{usd(prices[l.id] * l.qty)}</span></div>; })}
        <div><span>Price ({count} item{count > 1 ? 's' : ''})</span><span>{usd(total)}</span></div>
        <div><span>Delivery charges</span><span className="fk-delivery-free">Free</span></div>
        <div className="co-total"><span>Total amount</span><span>{usd(total)}</span></div>
        {item ? <Link to="/shop/$watchId" params={{ watchId: item }} className="co-change">← Back to product</Link> : <Link to="/collection" className="co-change">← Keep shopping</Link>}
      </aside>}
    </div>
  </main>;
}
