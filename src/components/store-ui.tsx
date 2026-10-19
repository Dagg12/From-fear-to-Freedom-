'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

type AuthMode = 'login' | 'register' | 'reset' | 'update-password';

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('update_password')) setMode('update-password');
    else if (params.has('email_confirmed')) setMessage('Your email is confirmed. You can now sign in.');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!hasSupabaseConfig()) {
      setMessage('Authentication is not configured. Add the Supabase project URL and browser-safe key to the deployment environment, then redeploy.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/login?email_confirmed=1`,
          },
        });
        if (error) throw error;
        setMessage('Account created. Check your email for a confirmation link before signing in.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?update_password=1`,
        });
        if (error) throw error;
        setMessage('If the email exists, a password reset link has been sent.');
      } else if (mode === 'update-password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode('login');
        setPassword('');
        setMessage('Your password has been updated. You can now sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Could not verify the signed-in account.');
        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        window.location.assign(profile?.is_admin ? '/admin' : '/account');
      }
    } catch (error) {
      if (mode === 'login' && error instanceof Error && error.message.toLowerCase().includes('email not confirmed')) {
        setMessage('Please verify your email using the link we sent before signing in.');
      } else {
        setMessage(error instanceof Error ? error.message : 'Authentication could not be completed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className="container section-space max-w-xl"><div className="surface overflow-hidden">
    <div className="bg-[#32131d] px-7 py-8 text-white sm:px-10"><p className="eyebrow !text-[#c9a96e]">Welcome to the community</p>
      <h1 className="font-display mt-3 text-4xl">{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Begin your next chapter.' : mode === 'update-password' ? 'Choose a new password.' : 'Reset your password.'}</h1>
      <p className="mt-2 text-sm leading-6 text-white/70">Sign in to view your reader account and orders.</p>
    </div>
    <form onSubmit={submit} className="grid gap-4 p-7 sm:p-10">
      {mode === 'register' && <label className="text-xs font-bold">Full name<input required maxLength={120} autoComplete="name" className="field mt-2" value={name} onChange={(event) => setName(event.target.value)}/></label>}
      {mode !== 'update-password' && <label className="text-xs font-bold">Email address<input required type="email" autoComplete="email" className="field mt-2" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>}
      {mode !== 'reset' && <label className="text-xs font-bold">{mode === 'update-password' ? 'New password' : 'Password'}<input required minLength={mode === 'login' ? 1 : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" className="field mt-2" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}/></label>}
      <button disabled={busy} className="btn btn-primary mt-2 w-full disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Update password'} <ArrowRight size={15}/></button>
      {message && <p role="status" className="rounded-lg bg-[#f6efe5] p-3 text-xs leading-5 text-[#694a41]">{message}</p>}
      {mode === 'update-password' ? <button type="button" className="text-left text-xs text-[#7e5d55] underline" onClick={() => { setMode('login'); setPassword(''); setMessage(''); }}>Back to sign in</button> :
        <div className="flex flex-wrap justify-between gap-3 text-xs">
          <button type="button" className="text-[#7e5d55] underline" onClick={() => { setMode(mode === 'reset' ? 'login' : 'reset'); setMessage(''); }}>{mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}</button>
          <button type="button" className="text-[#7e5d55] underline" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setMessage(''); }}>{mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        </div>}
      <p className="text-[10px] leading-5 text-[#897c77]">{hasSupabaseConfig() ? 'New accounts must verify their email before signing in.' : 'Supabase authentication is required for real accounts.'}</p>
    </form>
  </div></div>;
}
