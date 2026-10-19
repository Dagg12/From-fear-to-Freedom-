'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

export function ReviewForm() {
  const [bookId, setBookId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('Reader reviews are unavailable until Supabase is configured.');
      return;
    }
    let alive = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: { user } }, { data: book, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('books').select('id').eq('slug', 'from-fear-to-freedom').eq('is_published', true).maybeSingle(),
      ]);
      if (!alive) return;
      if (error) setMessage(error.message);
      setSignedIn(Boolean(user));
      if (user) setUserId(user.id);
      if (user?.user_metadata?.full_name) setName(user.user_metadata.full_name);
      if (book) setBookId(book.id);
      else setMessage('The featured book is not yet available for review.');
    })();
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn || !userId || !bookId) {
      setMessage('Sign in and choose an available book before submitting a review.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await createClient().from('reviews').insert({
        book_id: bookId,
        user_id: userId,
        display_name: name.trim(),
        rating,
        body: review.trim(),
      });
      if (error) setMessage(error.code === '23505' ? 'You have already reviewed this book.' : error.message);
      else {
        setMessage('Your review was submitted for moderation.');
        setReview('');
      }
    } catch {
      setMessage('Unable to submit your review. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="surface grid gap-4 p-6">
    <h3 className="font-display text-2xl text-[#581d2b]">Share your reflection</h3>
    {!signedIn && <p className="text-sm text-[#766b67]">Please <Link href="/login" className="underline">sign in</Link> before writing a review.</p>}
    <label className="text-xs font-bold">Your name<input className="field mt-2" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)}/></label>
    <div><p className="mb-2 text-xs font-bold">Your rating</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map((number) => <button type="button" key={number} onClick={() => setRating(number)} aria-label={`${number} stars`}><Star size={22} fill={number <= rating ? '#b99a62' : 'none'} color="#b99a62"/></button>)}</div></div>
    <label className="text-xs font-bold">Your review<textarea className="field mt-2 min-h-28" required minLength={10} maxLength={3000} value={review} onChange={(event) => setReview(event.target.value)} placeholder="What did this story make you think or feel?"/></label>
    <button disabled={busy || !signedIn || !bookId} className="btn btn-primary disabled:opacity-50">{busy ? 'Submitting…' : 'Submit review'}</button>
    {message && <p role="status" className="text-xs leading-5 text-[#694a41]">{message}</p>}
  </form>;
}
