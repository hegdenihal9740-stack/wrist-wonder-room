import { useSyncExternalStore } from 'react';
import type { WatchTone } from '@/lib/watches';

export const prices: Record<WatchTone, number> = { steel: 12800, black: 14500, gold: 18500, rosegold: 16900 };
export type CartItem = { id: WatchTone; qty: number };

const KEY = 'private-flight-cart';
let items: CartItem[] = [];
let loaded = false;
let openState = false;
const listeners = new Set<() => void>();
const emit = () => { listeners.forEach(l => l()); };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } };
const load = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) items = JSON.parse(raw) as CartItem[]; } catch { /* ignore */ }
};

export const cart = {
  add(id: WatchTone) { load(); const f = items.find(i => i.id === id); items = f ? items.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i) : [...items, { id, qty: 1 }]; openState = true; save(); emit(); },
  setQty(id: WatchTone, qty: number) { items = qty <= 0 ? items.filter(i => i.id !== id) : items.map(i => i.id === id ? { ...i, qty } : i); save(); emit(); },
  clear() { items = []; save(); emit(); },
  setOpen(v: boolean) { openState = v; emit(); },
};

const subscribe = (l: () => void) => { load(); listeners.add(l); queueMicrotask(l); return () => { listeners.delete(l); }; };
const EMPTY: CartItem[] = [];
export function useCart() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const open = useSyncExternalStore(subscribe, () => openState, () => false);
  return { items: list, open, count: list.reduce((s, i) => s + i.qty, 0), total: list.reduce((s, i) => s + i.qty * prices[i.id], 0) };
}

export const formatPrice = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
