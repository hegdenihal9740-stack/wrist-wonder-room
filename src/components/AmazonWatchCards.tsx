import { Link } from '@tanstack/react-router';
import { ScanLine, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cart, prices } from '@/lib/cart';
import { watches, type WatchTone } from '@/lib/watches';
import { isBuiltIn } from '@/lib/products';
import { cardMeta as meta } from '@/lib/watch-meta';

const usd = (n: number) => n.toLocaleString('en-IN');

function Stars({ value }: { value: number }) {
  return (
    <span className="az-stars" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="az-star">
            <Star size={15} className="az-star-bg" />
            <span style={{ width: `${fill * 100}%` }}><Star size={15} fill="currentColor" /></span>
          </span>
        );
      })}
    </span>
  );
}

export function WatchProductCard({ tone }: { tone: WatchTone }) {
  const w = watches.find((x) => x.id === tone);
  if (!w) return null;
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const m = meta[w.id];
  const price = prices[w.id];
  const off = Math.round((1 - price / m.list) * 100);
  return (
    <article className="az-card">
      {m.badge && <span className="az-badge">{m.badge}</span>}
      <Link to="/shop/$watchId" params={{ watchId: w.id }} className="az-img"><img src={w.image} alt={w.name} loading="lazy" /></Link>
      <div className="az-body">
        <p className="az-eyebrow">Private Flight · {w.finish}</p>
        <Link to="/shop/$watchId" params={{ watchId: w.id }} className="az-title">{w.name}</Link>
        <p className="az-specs">{m.specs.join(' · ')}</p>
        <div className="az-price-row">
          <span className="az-price">₹{usd(price)}</span>
          <s className="az-muted">₹{usd(m.list)}</s>
          <span className="az-off">−{off}%</span>
        </div>
        <div className="az-rating"><Stars value={m.rating} /><span>{m.rating}</span><span className="az-muted">({usd(m.reviews)})</span></div>
        <p className="az-small az-muted">Delivered by {tomorrow}{m.stock ? ` · only ${m.stock} left` : ''}</p>
        <button type="button" className="az-add" onClick={() => { cart.add(w.id); toast.success(`${w.name} added to cart`); }}>Add to cart</button>
        <div className="az-links">
          {isBuiltIn(w.id) && <Link to="/watches/$watchId" params={{ watchId: w.id }} search={{ tryon: true }} className="az-tryon"><ScanLine size={14} /> Try on</Link>}
          <Link to="/shop/$watchId" params={{ watchId: w.id }} className="az-more">Details</Link>
        </div>
      </div>
    </article>
  );
}

export function AmazonWatchCards() {
  return (
    <section className="az-section" aria-labelledby="az-title">
      <h2 id="az-title">Shop the collection</h2>
      <div className="az-grid">
        {watches.map((w) => <WatchProductCard key={w.id} tone={w.id} />)}
      </div>
    </section>
  );
}
