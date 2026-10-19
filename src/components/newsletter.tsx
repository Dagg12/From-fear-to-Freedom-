'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSupabaseConfig()) {
      setMessage('Newsletter sign-up is currently unavailable.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await createClient().from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() });
      if (error?.code === '23505') setMessage('This email is already subscribed.');
      else if (error) setMessage('Unable to subscribe right now. Please try again later.');
      else {
        setMessage('You are subscribed. You may unsubscribe by contacting the author.');
        setEmail('');
      }
    } catch {
      setMessage('Unable to subscribe right now. Please try again later.');
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
    <input required type="email" maxLength={254} className="field !rounded-full" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)}/>
    <label className="flex items-start gap-2 text-xs leading-5 sm:items-center"><input required type="checkbox" className="mt-1 sm:mt-0"/> I agree to receive newsletter updates. See the <a href="/privacy" className="underline">privacy notice</a>.</label>
    <button disabled={busy} className="btn btn-gold shrink-0">{busy ? 'Saving…' : 'Subscribe'} <ArrowRight size={15}/></button>
    {message && <p role="status" className="basis-full text-xs leading-5 text-[#766b67]">{message}</p>}
  </form>;
}
