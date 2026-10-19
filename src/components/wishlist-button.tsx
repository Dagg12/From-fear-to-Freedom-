'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

export function WishlistButton({ bookSlug = 'from-fear-to-freedom' }: { bookSlug?: string }) {
  const [bookId, setBookId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let alive = true;
    void (async () => {
      const supabase = createClient();
      const { data: book, error: bookError } = await supabase.from('books').select('id').eq('slug', bookSlug).eq('is_published', true).maybeSingle();
      if (!alive) return;
      if (bookError || !book) return;
      setBookId(book.id);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('wishlists').select('book_id').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
      if (!alive) return;
      if (error) setMessage('Unable to load your saved books.');
      else setSaved(Boolean(data));
    })();
    return () => { alive = false; };
  }, [bookSlug]);

  async function toggle() {
    setMessage('');
    if (!bookId) {
      setMessage('This book is not available to save.');
      return;
    }
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setMessage(authError.message);
      return;
    }
    if (!user) {
      setMessage('Sign in to save books to your wishlist.');
      return;
    }
    const result = saved
      ? await supabase.from('wishlists').delete().eq('user_id', user.id).eq('book_id', bookId)
      : await supabase.from('wishlists').insert({ user_id: user.id, book_id: bookId });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setSaved(!saved);
  }
  return <div>
    <button type="button" onClick={() => void toggle()} className="btn btn-outline !px-4"><Heart size={16} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Saved' : 'Save to wishlist'}</button>
    {message && <p role="status" className="mt-2 text-xs text-[#766b67]">{message}{message.includes('Sign in') && <> <Link href="/login" className="underline">Sign in</Link></>}</p>}
  </div>;
}
