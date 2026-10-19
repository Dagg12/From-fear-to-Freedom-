'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';

export type Book = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  price: number;
  currency: string;
  cover_path: string | null;
  format: string;
  stock_quantity: number | null;
  is_preorder: boolean;
  available_on: string | null;
  is_published: boolean;
};

export function AddToCart({ bookId = 'from-fear-to-freedom' }: { bookId?: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('The live store is unavailable. Please try again later.');
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('books').select('*').eq('slug', bookId).eq('is_published', true).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load current book availability.');
        else if (data) setBook(data as Book);
        else setMessage('This book is not currently available to order.');
      }))
      .catch(() => { if (alive) setMessage('Unable to load current book availability.'); });
    return () => { alive = false; };
  }, [bookId]);

  function addBook() {
    if (!book) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('fff-cart') ?? '[]');
      const cart = Array.isArray(saved) ? saved as Array<Record<string, unknown>> : [];
      const current = cart.find((item) => item.id === book.id);
      if (current && (!Number.isInteger(Number(current.qty)) || Number(current.qty) >= 20)) {
        setMessage('A maximum of 20 copies per book may be ordered at once.');
        return;
      }
      const next = current
        ? cart.map((item) => item.id === book.id ? { ...item, qty: Number(item.qty) + 1 } : item)
        : [...cart, {
          id: book.id,
          title: book.title,
          price: Number(book.price),
          cover: book.cover_path || '/images/book-product.webp',
          qty: 1,
          subtitle: book.subtitle || book.format,
        }];
      localStorage.setItem('fff-cart', JSON.stringify(next));
      window.dispatchEvent(new Event('fff-cart-update'));
      setMessage('Added to your bag.');
    } catch {
      setMessage('Unable to update your bag in this browser.');
    }
  }

  return <div>
    <button type="button" disabled={!book} onClick={addBook} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
      <ShoppingBag size={16}/>{book ? `Add to bag · ${book.currency} ${Number(book.price).toFixed(2)}` : 'Loading book…'}
    </button>
    {message && <p role="status" className="mt-2 text-xs text-[#766b67]">{message}</p>}
  </div>;
}

export function BookPrice({ bookId = 'from-fear-to-freedom' }: { bookId?: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    let alive = true;
    void Promise.resolve(createClient().from('books').select('*').eq('slug', bookId).eq('is_published', true).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load the current price.');
        else if (data) setBook(data as Book);
        else setMessage('See the store for current availability.');
      }))
      .catch(() => { if (alive) setMessage('Unable to load the current price.'); });
    return () => { alive = false; };
  }, [bookId]);
  if (!book) return <p role="status" className="text-xs text-[#897c75]">{message || 'Loading current price…'}</p>;
  return <div className="space-y-1">
    <p className="font-display text-3xl text-[#581d2b]">{book.currency} {Number(book.price).toFixed(2)}</p>
    <p className="text-xs text-[#897c75]">{book.is_preorder
      ? `Pre-order${book.available_on ? ` for ${new Date(`${book.available_on}T00:00:00`).toLocaleDateString()}` : ''}`
      : book.stock_quantity === 0 ? 'Currently out of stock' : 'Available now'}</p>
  </div>;
}

export function BookCatalogue() {
  const [books, setBooks] = useState<Book[]>([]);
  const [message, setMessage] = useState('Loading books…');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('The live store is unavailable. Please try again later.');
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('books').select('*').eq('is_published', true).order('featured', { ascending: false }).order('title')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load the catalogue. Please try again later.');
        else {
          setBooks((data ?? []) as Book[]);
          setMessage(data?.length ? '' : 'There are no books available yet.');
        }
      }))
      .catch(() => {
        if (alive) setMessage('Unable to load the catalogue. Please try again later.');
      });
    return () => { alive = false; };
  }, []);
  return <div className="mt-10">
    {message && <p role="status" className="surface p-6 text-sm text-[#766b67]">{message}</p>}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{books.map((book) => <article key={book.id} className="surface overflow-hidden">
      <Link href={`/book/${encodeURIComponent(book.slug)}`} className="block bg-[#efe3d4] p-5">
        <img src={book.cover_path || '/images/book-product.webp'} alt={`${book.title} cover`} className="mx-auto h-72 w-full rounded-sm object-contain"/>
      </Link>
      <div className="space-y-3 p-5">
        <p className="eyebrow">{book.is_preorder ? 'Pre-order' : 'Available now'} · {book.format}</p>
        <h2 className="font-display text-2xl text-[#581d2b]">{book.title}</h2>
        {book.subtitle && <p className="text-sm italic text-[#7b625b]">{book.subtitle}</p>}
        <p className="text-sm font-semibold">{book.currency} {Number(book.price).toFixed(2)}</p>
        <AddToCart bookId={book.slug}/>
      </div>
    </article>)}</div>
  </div>;
}
