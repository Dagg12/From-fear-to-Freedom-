'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, hasSupabaseConfig } from '@/lib';
import type { Book } from '@/components/book-catalogue';

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
};

type Review = {
  id: string;
  display_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: 'pending' | 'approved' | 'hidden';
  created_at: string;
};

type StoreEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  starts_at: string;
  location_name: string | null;
  status: 'draft' | 'published' | 'cancelled';
};

function isEventStatus(value: string): value is StoreEvent['status'] {
  return value === 'draft' || value === 'published' || value === 'cancelled';
}

const initialForm = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  price: '',
  format: 'Paperback',
  coverPath: '',
  stock: '',
  isPreorder: true,
  availableOn: '',
  isPublished: false,
};
const initialEventForm = {
  title: '',
  slug: '',
  summary: '',
  description: '',
  startsAt: '',
  endsAt: '',
  locationName: '',
  address: '',
  bookingUrl: '',
  isPublished: false,
};

export function AdminDashboard() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<'books' | 'orders' | 'reviews' | 'events'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [events, setEvents] = useState<StoreEvent[]>([]);
  const [form, setForm] = useState(initialForm);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [bookResult, orderResult, reviewResult, eventResult] = await Promise.all([
      supabase.from('books').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('id,order_number,customer_name,customer_email,status,total,currency,created_at').order('created_at', { ascending: false }),
      supabase.from('reviews').select('id,display_name,rating,title,body,status,created_at').order('created_at', { ascending: false }),
      supabase.from('events').select('id,slug,title,summary,starts_at,location_name,status').order('starts_at', { ascending: false }),
    ]);
    if (bookResult.error) throw bookResult.error;
    if (orderResult.error) throw orderResult.error;
    if (reviewResult.error) throw reviewResult.error;
    if (eventResult.error) throw eventResult.error;
    setBooks((bookResult.data ?? []) as Book[]);
    setOrders((orderResult.data ?? []) as Order[]);
    setReviews((reviewResult.data ?? []) as Review[]);
    setEvents((eventResult.data ?? []) as StoreEvent[]);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setError('Supabase is not configured for this deployment.');
      setChecking(false);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return;
        const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.is_admin) return;
        await loadData();
        if (alive) setAuthorized(true);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Unable to verify administrator access.');
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [loadData]);

  async function addBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const price = Number(form.price);
    const stock = form.stock.trim() ? Number(form.stock) : null;
    if (!Number.isFinite(price) || price <= 0 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
      setError('Enter a valid price and a whole-number stock quantity.');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await createClient().from('books').insert({
        title: form.title.trim(),
        slug: form.slug.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim(),
        price,
        currency: 'ZAR',
        format: form.format.trim(),
        cover_path: form.coverPath.trim() || null,
        stock_quantity: stock,
        is_preorder: form.isPreorder,
        available_on: form.availableOn || null,
        is_published: form.isPublished,
        featured: false,
      });
      if (insertError) throw insertError;
      await loadData();
      setForm(initialForm);
      setNotice('Book saved to the catalogue. Published books are now available in the storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this book.');
    } finally {
      setSaving(false);
    }
  }

  async function setPublication(book: Book, isPublished: boolean) {
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await createClient().from('books').update({ is_published: isPublished }).eq('id', book.id);
      if (updateError) throw updateError;
      await loadData();
      setNotice(`${book.title} ${isPublished ? 'published in' : 'removed from'} the storefront.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update book visibility.');
    }
  }

  async function updateOrder(order: Order, status: string) {
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await createClient().from('orders').update({ status }).eq('id', order.id);
      if (updateError) throw updateError;
      await loadData();
      setNotice(`${order.order_number} updated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update order.');
    }
  }

  async function moderateReview(review: Review, status: Review['status']) {
    setError('');
    setNotice('');
    try {
      const { data: { user }, error: authError } = await createClient().auth.getUser();
      if (authError || !user) throw authError ?? new Error('Administrator session expired. Sign in again.');
      const { error: updateError } = await createClient().from('reviews').update({
        status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      }).eq('id', review.id);
      if (updateError) throw updateError;
      await loadData();
      setNotice(`Review ${status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to moderate review.');
    }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const startsAt = new Date(`${eventForm.startsAt}:00+02:00`);
    const endsAt = eventForm.endsAt ? new Date(`${eventForm.endsAt}:00+02:00`) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) {
      setError('Enter a valid start date and an end date later than the start.');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await createClient().from('events').insert({
        title: eventForm.title.trim(),
        slug: eventForm.slug.trim(),
        summary: eventForm.summary.trim() || null,
        description: eventForm.description.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt?.toISOString() ?? null,
        timezone: 'Africa/Johannesburg',
        location_name: eventForm.locationName.trim() || null,
        address: eventForm.address.trim() || null,
        booking_url: eventForm.bookingUrl.trim() || null,
        status: eventForm.isPublished ? 'published' : 'draft',
      });
      if (insertError) throw insertError;
      await loadData();
      setEventForm(initialEventForm);
      setNotice('Event saved to the calendar.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  }

  async function updateEventStatus(event: StoreEvent, status: StoreEvent['status']) {
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await createClient().from('events').update({ status }).eq('id', event.id);
      if (updateError) throw updateError;
      await loadData();
      setNotice(`Event ${status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update event.');
    }
  }

  if (checking) return <div className="container section-space"><p role="status" className="body-copy">Verifying your administrator account…</p></div>;
  if (!authorized) return <div className="container section-space max-w-xl"><div className="surface p-7 sm:p-10">
    <p className="eyebrow">Restricted area</p><h1 className="heading mt-3">Admin access only.</h1>
    <p className="body-copy mt-4">Sign in with the Supabase account that has the administrator role.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <Link href="/login" className="btn btn-primary mt-6">Go to secure login</Link>
  </div></div>;

  return <div className="container section-space">
    <p className="eyebrow">Store management</p><h1 className="heading mt-3">Admin dashboard.</h1>
    <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="surface h-fit p-3">{(['books', 'orders', 'reviews', 'events'] as const).map((name) => <button key={name} type="button" onClick={() => setTab(name)} className={`mb-1 block w-full rounded-lg px-4 py-3 text-left text-xs font-bold capitalize ${tab === name ? 'bg-[#581d2b] text-white' : 'text-[#665853] hover:bg-[#f5eee5]'}`}>{name} ({name === 'books' ? books.length : name === 'orders' ? orders.length : name === 'reviews' ? reviews.length : events.length})</button>)}
        <p className="mt-3 border-t border-[#e9dfd3] px-3 pt-3 text-[10px] leading-5 text-[#8a7c76]">Changes are saved to the configured Supabase database.</p>
      </aside>
      <section className="surface min-h-[380px] p-5 sm:p-8">
        {tab === 'books' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Books and pre-orders</h2>
          <form onSubmit={addBook} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold">Book title<input required className="field mt-2" value={form.title} onChange={(event) => {
              const title = event.target.value;
              setForm((current) => ({ ...current, title, slug: current.slug || title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
            }}/></label>
            <label className="text-xs font-bold">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="field mt-2" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })}/></label>
            <label className="text-xs font-bold">Subtitle<input className="field mt-2" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })}/></label>
            <label className="text-xs font-bold">Price (ZAR)<input required type="number" min="0.01" step="0.01" className="field mt-2" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label>
            <label className="text-xs font-bold md:col-span-2">Description<textarea className="field mt-2 min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
            <label className="text-xs font-bold">Cover image URL or path<input className="field mt-2" placeholder="/images/book-product.webp" value={form.coverPath} onChange={(event) => setForm({ ...form, coverPath: event.target.value })}/></label>
            <label className="text-xs font-bold">Format<input required className="field mt-2" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}/></label>
            <label className="text-xs font-bold">Stock quantity (leave blank if unlimited)<input type="number" min="0" step="1" className="field mt-2" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })}/></label>
            <label className="text-xs font-bold">Pre-order fulfilment date<input type="date" className="field mt-2" value={form.availableOn} onChange={(event) => setForm({ ...form, availableOn: event.target.value })}/></label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.isPreorder} onChange={(event) => setForm({ ...form, isPreorder: event.target.checked })}/> Accept as a pre-order</label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })}/> Publish in the storefront immediately</label>
            <button disabled={saving} className="btn btn-primary md:col-span-2">{saving ? 'Saving…' : 'Add book to catalogue'}</button>
          </form>
          <div className="mt-8 space-y-3">{books.map((book) => <article key={book.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fbf7f0] p-4">
            <div><p className="font-semibold">{book.title}</p><p className="mt-1 text-xs text-[#766b67]">{book.currency} {Number(book.price).toFixed(2)} · {book.is_preorder ? `Pre-order${book.available_on ? ` until ${book.available_on}` : ''}` : 'Standard sale'} · {book.is_published ? 'Published' : 'Draft'}</p></div>
            <button type="button" onClick={() => void setPublication(book, !book.is_published)} className="btn btn-outline !py-2">{book.is_published ? 'Unpublish' : 'Publish'}</button>
          </article>)}</div>
        </> : tab === 'orders' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Orders and fulfilment</h2>
          <div className="mt-6 space-y-3">{orders.length === 0 ? <p className="body-copy text-sm">No customer orders yet.</p> : orders.map((order) => <article key={order.id} className="rounded-xl bg-[#fbf7f0] p-4">
            <div className="flex flex-wrap justify-between gap-3"><strong>{order.order_number}</strong><strong>{order.currency} {Number(order.total).toFixed(2)}</strong></div>
            <p className="mt-2 text-xs text-[#766b67]">{order.customer_name} · {order.customer_email} · {new Date(order.created_at).toLocaleDateString()}</p>
            <div className="mt-3 flex items-center gap-3"><span className="text-xs capitalize">Status: {order.status}</span><select aria-label={`Update ${order.order_number} status`} className="field max-w-48 !py-2" value={order.status} onChange={(event) => void updateOrder(order, event.target.value)}>
              {['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select></div>
          </article>)}</div>
        </> : tab === 'reviews' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Reader reviews</h2>
          <div className="mt-6 space-y-3">{reviews.length === 0 ? <p className="body-copy text-sm">No reader reviews have been submitted yet.</p> : reviews.map((review) => <article key={review.id} className="rounded-xl bg-[#fbf7f0] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><strong>{review.display_name} · {'★'.repeat(review.rating)}</strong><span className="text-xs capitalize">{review.status}</span></div>
            {review.title && <p className="mt-2 text-sm font-semibold">{review.title}</p>}
            <p className="mt-2 text-sm leading-6 text-[#5e514d]">{review.body}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void moderateReview(review, 'approved')} className="btn btn-outline !py-2">Approve</button><button type="button" onClick={() => void moderateReview(review, 'hidden')} className="btn btn-outline !py-2">Hide</button></div>
          </article>)}</div>
        </> : <>
          <h2 className="font-display text-3xl text-[#581d2b]">Events and appearances</h2>
          <form onSubmit={addEvent} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold">Event title<input required maxLength={200} className="field mt-2" value={eventForm.title} onChange={(event) => {
              const title = event.target.value;
              setEventForm((current) => ({ ...current, title, slug: current.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
            }}/></label>
            <label className="text-xs font-bold">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="field mt-2" value={eventForm.slug} onChange={(event) => setEventForm({ ...eventForm, slug: event.target.value })}/></label>
            <label className="text-xs font-bold">Start (South African time)<input required type="datetime-local" className="field mt-2" value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })}/></label>
            <label className="text-xs font-bold">End (optional)<input type="datetime-local" className="field mt-2" value={eventForm.endsAt} onChange={(event) => setEventForm({ ...eventForm, endsAt: event.target.value })}/></label>
            <label className="text-xs font-bold">Location<input className="field mt-2" value={eventForm.locationName} onChange={(event) => setEventForm({ ...eventForm, locationName: event.target.value })}/></label>
            <label className="text-xs font-bold">Address<input className="field mt-2" value={eventForm.address} onChange={(event) => setEventForm({ ...eventForm, address: event.target.value })}/></label>
            <label className="text-xs font-bold md:col-span-2">Summary<input maxLength={500} className="field mt-2" value={eventForm.summary} onChange={(event) => setEventForm({ ...eventForm, summary: event.target.value })}/></label>
            <label className="text-xs font-bold md:col-span-2">Description<textarea className="field mt-2 min-h-24" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })}/></label>
            <label className="text-xs font-bold md:col-span-2">Booking URL<input type="url" className="field mt-2" value={eventForm.bookingUrl} onChange={(event) => setEventForm({ ...eventForm, bookingUrl: event.target.value })}/></label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={eventForm.isPublished} onChange={(event) => setEventForm({ ...eventForm, isPublished: event.target.checked })}/> Publish on the event calendar</label>
            <button disabled={saving} className="btn btn-primary md:col-span-2">{saving ? 'Saving…' : 'Save event'}</button>
          </form>
          <div className="mt-8 space-y-3">{events.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fbf7f0] p-4">
            <div><p className="font-semibold">{event.title}</p><p className="mt-1 text-xs text-[#766b67]">{new Date(event.starts_at).toLocaleString()} · {event.location_name || 'Location to be confirmed'} · {event.status}</p></div>
            <select aria-label={`Update ${event.title} status`} className="field max-w-40 !py-2" value={event.status} onChange={(change) => {
              const status = change.target.value;
              if (isEventStatus(status)) void updateEventStatus(event, status);
            }}>
              {(['draft', 'published', 'cancelled'] as const).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </article>)}</div>
        </>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg bg-[#f3ebdd] p-3 text-sm text-[#694a41]">{notice}</p>}
      </section>
    </div>
  </div>;
}
