import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import { useCustomer } from '@/components/CustomerAccounts';
import { AccountLayout } from '@/components/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{ title: 'Customer account — Private Flight' }, { name: 'description', content: 'Register, sign in and manage your Private Flight customer profile.' }, { property: 'og:title', content: 'Customer account — Private Flight' }, { property: 'og:description', content: 'Your Private Flight customer account.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, ready } = useCustomer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    void (supabase as any).from('profiles').select('display_name').eq('id', user.id).maybeSingle().then(({ data, error }: { data: { display_name?: string } | null; error: unknown }) => {
      if (error) setError('Your profile could not be loaded. Please try again.');
      else setName(data?.display_name ?? '');
    });
  }, [user?.id]);
  const changeMode = (next: typeof mode) => { setMode(next); setMessage(''); setError(''); setPassword(''); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (user) {
        const { error } = await (supabase as any).from('profiles').upsert({ id: user.id, display_name: name.trim() });
        if (error) throw error;
        setMessage('Your profile has been saved.');
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.user && (data.user.identities ?? []).length === 0) { setError('This email is already registered. Please log in instead.'); setMode('login'); return; }
        setMessage(data.session ? 'Your account is ready.' : 'Check your email and confirm your account before signing in.');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('If an account exists, a password reset link has been sent.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password. Try again or use "Forgot password?".' : error.message);
        setMessage('You are signed in.');
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function social(provider: 'google' | 'lovable') {
    setError(''); setBusy(true);
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` }); if (result.error) setError(result.error.message); }
    catch { setError('Sign-in could not be completed. Please try again.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      await queryClient.cancelQueries(); queryClient.clear();
      const { error } = await supabase.auth.signOut(); if (error) throw error;
      await navigate({ to: '/auth', replace: true }); setMessage('You have signed out.'); setPassword('');
    } catch { setError('Sign-out failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <AccountLayout title={user ? 'My account' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}>
    {!ready ? <p role="status">Loading your account…</p> : <>
      {user ? <p className="mb-6 break-all text-muted-foreground">{user.email}</p> : mode !== 'forgot' && <div className="mb-6 grid grid-cols-2 gap-2"><Button variant={mode === 'login' ? 'default' : 'outline'} onClick={() => changeMode('login')}>Login</Button><Button variant={mode === 'register' ? 'default' : 'outline'} onClick={() => changeMode('register')}>Register</Button></div>}
      <form onSubmit={submit} className="space-y-5">
        {(user || mode === 'register') && <label className="block space-y-2 text-sm"><span>Full name</span><Input autoComplete="name" required value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>}
        {!user && <label className="block space-y-2 text-sm"><span>Email address</span><Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {!user && mode !== 'forgot' && <label className="block space-y-2 text-sm"><span>Password</span><Input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />{mode === 'register' && <span className="text-muted-foreground">At least 8 characters</span>}</label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-foreground">{message}</p>}
        <Button disabled={busy} className="w-full" type="submit">{busy ? 'Please wait…' : user ? 'Save profile' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</Button>
      </form>
      {user ? <div className="mt-6 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/">Continue shopping</Link></Button><Button variant="ghost" disabled={busy} onClick={signOut}>Sign out</Button></div> : <>
        <Button variant="link" className="my-4 px-0" onClick={() => changeMode(mode === 'forgot' ? 'login' : 'forgot')}>{mode === 'forgot' ? 'Back to login' : 'Forgot password?'}</Button>
        {mode !== 'forgot' && <div className="space-y-3 border-t border-border pt-5"><Button variant="outline" className="w-full" disabled={busy} onClick={() => social('google')}>Continue with Google</Button><Button className="lovable-auth-button w-full" disabled={busy} onClick={() => social('lovable')}>Continue with Lovable</Button></div>}
      </>}
    </>}
  </AccountLayout>;
}
