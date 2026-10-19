'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { createClient, hasSupabaseConfig } from '@/lib';
import { BookPriceTag, type Book } from '@/components/book-catalogue';

type CartItem = { id: string; qty: number };

function isCartItem(value: unknown): value is CartItem {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'qty' in value && typeof value.qty === 'number' &&
    Number.isInteger(value.qty) && value.qty > 0 && value.qty <= 20;
}

export function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [catalogueAvailable, setCatalogueAvailable] = useState(false);
  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem('fff-cart') ?? '[]');
      if (Array.isArray(raw)) {
        const validItems = raw.filter(isCartItem);
        setCart(validItems);
        if (validItems.length !== raw.length) {
          setMessage('Some invalid or outdated items in your bag were removed.');
          localStorage.setItem('fff-cart', JSON.stringify(validItems));
        }
      } else {
        setMessage('Your saved bag was invalid and has been cleared.');
        localStorage.setItem('fff-cart', '[]');
      }
    } catch {
      setMessage('Your saved bag could not be read. Remove the invalid entries or clear this browser’s site data.');
    }
    if (!hasSupabaseConfig()) {
      setMessage('The live store is unavailable until Supabase is configured.');
      setLoaded(true);
      return;
    }
    let alive = true;
    void Promise.resolve(createClient().from('books').select('*').eq('is_published', true)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setMessage('Unable to verify current prices. Please try again later.');
        else {
          setBooks((data ?? []) as Book[]);
          setCatalogueAvailable(true);
        }
        setLoaded(true);
      }))
      .catch(() => {
        if (alive) {
          setMessage('Unable to verify current prices. Please try again later.');
          setLoaded(true);
        }
      });
    return () => { alive = false; };
  }, []);

  function update(id: string, quantity: number) {
    const next = cart.map((item) => item.id === id ? { ...item, qty: quantity } : item).filter((item) => item.qty > 0);
    setCart(next);
    localStorage.setItem('fff-cart', JSON.stringify(next));
    window.dispatchEvent(new Event('fff-cart-update'));
  }

  const available = cart.flatMap((item) => {
    const book = books.find((candidate) => candidate.id === item.id);
    return book ? [{ book, quantity: item.qty }] : [];
  });
  const unavailableCount = cart.length - available.length;
  const subtotal = available.reduce((sum, item) => sum + Number(item.book.price) * item.quantity, 0);
  return <div className="container section-space">
    <p className="eyebrow">Your next chapter</p><h1 className="heading mt-3">Your shopping bag.</h1>
    {message && <p role="status" className="mt-4 rounded-lg bg-[#f6efe5] p-3 text-sm text-[#694a41]">{message}</p>}
    {!loaded ? <p role="status" className="mt-8 text-sm text-[#766b67]">Verifying current catalogue prices…</p> :
      cart.length === 0 ? <div className="surface mt-10 p-8 text-center sm:p-14"><h2 className="font-display text-3xl text-[#581d2b]">Your bag is waiting for a story.</h2><Link href="/shop" className="btn btn-primary mt-6">Browse the bookstore <ArrowRight size={16}/></Link></div> :
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
          <div className="space-y-4">{available.map(({ book, quantity }) => <article key={book.id} className="surface flex gap-5 p-4 sm:p-6">
            <img src={book.cover_path || '/images/book-product.webp'} alt={`${book.title} cover`} className="w-24 rounded-md object-contain sm:w-32"/>
            <div className="flex flex-1 flex-col justify-between gap-4"><div>
              <h2 className="font-display text-2xl text-[#581d2b]">{book.title}</h2>
              <BookPriceTag book={book} className="mt-2 text-sm"/>
              <p className="mt-1 text-xs text-[#766b67]">{book.is_preorder ? `Pre-order${book.available_on ? ` · expected ${book.available_on}` : ''}` : 'Available now'}</p>
            </div><div className="flex items-center justify-between">
              <div className="flex items-center gap-3 rounded-full border border-[#e9dfd3] px-3 py-1.5">
                <button type="button" onClick={() => update(book.id, quantity - 1)} aria-label={`Remove one ${book.title}`}><Minus size={13}/></button>
                <span className="min-w-4 text-center text-sm">{quantity}</span>
                <button type="button" disabled={quantity >= 20} onClick={() => update(book.id, quantity + 1)} aria-label={`Add one ${book.title}`}><Plus size={13}/></button>
              </div><button type="button" onClick={() => update(book.id, 0)} aria-label={`Remove ${book.title}`} className="text-[#8a6c6c]"><Trash2 size={15}/></button>
            </div></div>
          </article>)}
          {catalogueAvailable && unavailableCount > 0 && <div role="alert" className="surface p-4 text-sm text-[#694a41]">{unavailableCount} item(s) in your bag are no longer published or available. <button type="button" className="ml-1 font-bold underline" onClick={() => {
            const availableIds = new Set(available.map(({ book }) => book.id));
            const next = cart.filter((item) => availableIds.has(item.id));
            setCart(next);
            localStorage.setItem('fff-cart', JSON.stringify(next));
          }}>Remove unavailable items</button></div>}
          </div>
          <aside className="surface h-fit p-6 sm:p-7">
            <h2 className="font-display text-2xl text-[#581d2b]">Order summary</h2>
            <div className="mt-6 flex justify-between text-sm"><span className="text-[#766b67]">Current book subtotal</span><span>ZAR {subtotal.toFixed(2)}</span></div>
            <p className="mt-3 text-xs leading-5 text-[#766b67]">Shipping is added at secure checkout. The server verifies all book prices and availability again before payment.</p>
            <Link aria-disabled={unavailableCount > 0} href={unavailableCount ? '/cart' : '/checkout'} className={`btn btn-primary mt-5 w-full ${unavailableCount ? 'pointer-events-none opacity-50' : ''}`}>Continue to checkout <ArrowRight size={16}/></Link>
          </aside>
        </div>}
  </div>;
}
