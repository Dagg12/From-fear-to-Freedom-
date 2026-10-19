'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, hasSupabaseConfig } from '@/lib';
import { AddToCart, BookPriceTag, type Book } from '@/components/book-catalogue';

export function WishlistPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('The saved-books service is unavailable until Supabase is configured.');
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (alive) { setMessage(authError.message); setLoading(false); }
        return;
      }
      if (!user) {
        if (alive) setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('wishlists').select('book:books(*)').eq('user_id', user.id);
      if (!alive) return;
      if (error) setMessage(error.message);
      else setBooks((data ?? []).flatMap((row) => row.book ? [row.book as unknown as Book] : []));
      setSignedIn(true);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);
  if (loading) return <div className="container section-space"><p role="status">Loading saved books…</p></div>;
  return <div className="container section-space">
    <p className="eyebrow">Saved for later</p><h1 className="heading mt-3">Your wishlist.</h1>
    {message && <p role="alert" className="mt-5 text-sm text-red-800">{message}</p>}
    {!signedIn ? <div className="surface mt-8 p-6"><p className="body-copy">Sign in to view and keep your saved books across devices.</p><Link href="/login" className="btn btn-primary mt-4">Sign in</Link></div> :
      books.length === 0 ? <div className="surface mt-8 p-6"><p className="body-copy">No saved books yet.</p><Link href="/shop" className="btn btn-primary mt-4">Browse the bookstore</Link></div> :
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{books.map((book) => <article key={book.id} className="surface p-5">
          <h2 className="font-display text-2xl text-[#581d2b]">{book.title}</h2><BookPriceTag book={book} className="mt-2 text-sm"/>
          <div className="mt-4 flex flex-wrap gap-3"><AddToCart bookId={book.slug}/><Link href={`/book/${book.slug}`} className="btn btn-outline">Book details</Link></div>
        </article>)}</div>}
  </div>;
}
