import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Instagram, Mail, MessageCircle, MoreVertical, Phone, UserRound, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cart, useCart } from '@/lib/cart';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { BottomNav } from '@/components/BottomNav';

// Contact links — placeholders until the owner shares real accounts.
const contacts = [
  { label: 'WhatsApp', icon: MessageCircle, href: '#' },
  { label: 'Instagram', icon: Instagram, href: '#' },
  { label: 'Email', icon: Mail, href: '#' },
];

const CUSTOMER_KEY = 'pf-customer';
export type LocalCustomer = { name: string; mobile: string };
export const getLocalCustomer = (): LocalCustomer | null => {
  try { const r = localStorage.getItem(CUSTOMER_KEY); return r ? (JSON.parse(r) as LocalCustomer) : null; } catch { return null; }
};

const authOrigin = () => /localhost|127\.0\.0\.1/.test(window.location.hostname) ? 'https://wrist-wonder-room.lovable.app' : window.location.origin;

function MobileLogin({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const done = (display: string) => {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: display, mobile: '' }));
    window.dispatchEvent(new Event('pf-customer'));
    toast.success(`Welcome, ${display}!`);
    setPassword(''); onOpenChange(false);
  };
  const submit = async () => {
    const mail = email.trim();
    if (mode === 'register' && !name.trim()) { toast.error('Enter your name'); return; }
    if (!/^\S+@\S+\.\S+$/.test(mail)) { toast.error('Enter a valid email'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setBusy(true);
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: authOrigin(), data: { display_name: name.trim() } } });
        if (error) { toast.error(error.message); return; }
        if (data.user && (data.user.identities ?? []).length === 0) { toast.error('This email is already registered. Please log in instead.'); setMode('login'); return; }
        if (data.session) { done(name.trim()); return; }
        toast.success(`Account created! Check ${mail} and tap the confirmation link, then log in.`);
        setMode('login');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) {
          toast.error(/confirm/i.test(error.message) ? 'Please confirm your email first — check your inbox.' : error.message === 'Invalid login credentials' ? 'Wrong email or password. Try again or reset your password.' : error.message);
          return;
        }
        const meta = data.user?.user_metadata ?? {};
        done(String(meta['display_name'] ?? meta['full_name'] ?? mail.split('@')[0]));
      }
    } finally { setBusy(false); }
  };
  const forgot = async () => {
    const mail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) { toast.error('Enter your email first'); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: `${authOrigin()}/reset-password` });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(`Password reset link sent to ${mail}.`);
  };
  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (result.error) { toast.error(`Google sign-in failed: ${result.error.message}`); return; }
      if (!result.redirected) onOpenChange(false);
    } catch { toast.error('Google sign-in could not be completed. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="shop-login">
      <DialogTitle className="shop-login-title">{mode === 'login' ? 'Login' : 'Create account'}</DialogTitle>
      <button type="button" className="fk-buy shop-login-btn" disabled={busy} onClick={google}>Continue with Google</button>
      <DialogDescription className="shop-login-sub">Or use your email and password.</DialogDescription>
      {mode === 'register' && <input className="shop-input" autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
      <input className="shop-input" type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="shop-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} />
      <button type="button" className="fk-buy shop-login-btn" disabled={busy} onClick={submit}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
      <div className="shop-login-sub" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="underline" disabled={busy} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Register' : 'Have an account? Login'}</button>
        {mode === 'login' && <button type="button" className="underline" disabled={busy} onClick={forgot}>Forgot password?</button>}
      </div>
    </DialogContent>
  </Dialog>;
}

export function ShopHeader() {
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const [customer, setCustomer] = useState<LocalCustomer | null>(null);
  useEffect(() => {
    const read = () => setCustomer(getLocalCustomer());
    const fromSession = (user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user || getLocalCustomer()) return;
      const name = String(user.user_metadata?.['full_name'] ?? user.user_metadata?.['name'] ?? user.email ?? 'Customer');
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, mobile: '' }));
      read();
    };
    read();
    void supabase.auth.getUser().then(({ data }) => fromSession(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') fromSession(session?.user);
      if (event === 'SIGNED_OUT') { localStorage.removeItem(CUSTOMER_KEY); read(); }
    });
    window.addEventListener('pf-customer', read);
    return () => { window.removeEventListener('pf-customer', read); sub.subscription.unsubscribe(); };
  }, []);
  const { count } = useCart();
  return <header className="shop-header">
    <div className="shop-menu-wrap">
      <button type="button" className="shop-icon-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreVertical size={20} /></button>
      {menu && <div className="shop-menu">
        <p className="shop-menu-label"><Phone size={14} /> Contact</p>
        <div className="shop-contacts">{contacts.map(({ label, icon: Icon, href }) => <a key={label} href={href} aria-label={label} title={label} className="shop-contact"><Icon size={20} /><span>{label}</span></a>)}</div>
      </div>}
    </div>
    <Link to="/" className="shop-brand">Private Flight</Link>
    <div className="shop-right">
      <button type="button" className="shop-icon-btn" aria-label="Open cart" onClick={() => cart.setOpen(true)}><ShoppingBag size={19} />{count > 0 && <span className="shop-count">{count}</span>}</button>
      {customer ? <button type="button" className="shop-login-link" onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem(CUSTOMER_KEY); window.dispatchEvent(new Event('pf-customer')); toast.success('Logged out'); }}><UserRound size={16} /> {customer.name.split(' ')[0]} · Logout</button>
        : <button type="button" className="shop-login-link" onClick={() => setLogin(true)}><UserRound size={16} /> Login / Register</button>}
    </div>
    <MobileLogin open={login} onOpenChange={setLogin} />
    <BottomNav />
  </header>;
}
