import { useSyncExternalStore } from 'react';
import type { WatchTone } from '@/lib/watches';

const KEY = 'pf-wishlist';
let list: WatchTone[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const load = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as WatchTone[]; } catch { list = []; }
};
const commit = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } listeners.forEach((l) => l()); };

export const wishlist = {
  toggle(id: WatchTone) { load(); list = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]; commit(); return list.includes(id); },
  remove(id: WatchTone) { load(); list = list.filter((x) => x !== id); commit(); },
};
const subscribe = (l: () => void) => { load(); listeners.add(l); queueMicrotask(l); return () => { listeners.delete(l); }; };
const EMPTY: WatchTone[] = [];
export const useWishlist = () => useSyncExternalStore(subscribe, () => list, () => EMPTY);
