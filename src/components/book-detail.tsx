'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, hasSupabaseConfig } from '@/lib';
import { AddToCart, BookPriceTag, type Book } from '@/components/book-catalogue';

export function BookDetail({ slug }: { slug: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setMessage('The live bookstore is unavailable.');
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('books').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to load this book.');
        else if (!data) setMessage('This book is not currently available.');
        else {
          setBook(data as Book);
          setMessage('');
        }
      }))
      .catch(() => {
        if (alive) setMessage('Unable to load this book.');
      });
    return () => { alive = false; };
  }, [slug]);

  if (!book) return <div className="container section-space">
    <p role="status" className="body-copy">{message || 'Book details and purchase options are available in the bookstore.'}</p>
    <Link href="/shop" className="btn btn-outline mt-5">Browse the bookstore</Link>
  </div>;
  return <div className="container section-space">
    <Link href="/shop" className="text-xs font-bold text-[#581d2b] underline">Back to the bookstore</Link>
    <div className="mt-7 grid items-center gap-10 md:grid-cols-2">
      <img src={book.cover_path || '/images/book-product.webp'} alt={`${book.title} cover`} className="mx-auto max-h-[620px] w-full rounded-lg bg-[#efe3d4] object-contain p-5"/>
      <section>
        <p className="eyebrow">{book.is_preorder ? 'Pre-order' : 'Available now'} · {book.format}</p>
        <h1 className="heading mt-3">{book.title}</h1>
        {book.subtitle && <p className="font-display mt-3 text-2xl italic text-[#745b54]">{book.subtitle}</p>}
        <p className="body-copy mt-5 whitespace-pre-line">{book.description}</p>
        <BookPriceTag book={book} className="mt-6 font-display text-3xl text-[#581d2b]"/>
        {book.is_preorder && <p className="mt-2 text-sm text-[#766b67]">Pre-orders ship later{book.available_on ? ` from ${new Date(`${book.available_on}T00:00:00`).toLocaleDateString()}` : ', when this title becomes available'}.</p>}
        {!book.is_preorder && book.stock_quantity === 0 && <p className="mt-2 text-sm text-red-800">Currently out of stock.</p>}
        <div className="mt-5"><AddToCart bookId={book.slug}/></div>
      </section>
    </div>
  </div>;
}
