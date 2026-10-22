'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
  shipping_address?: { fulfillment_method?: string; address?: string | null; pickup_location?: string } | null;
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

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_kind: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order_value: number;
  starts_at: string;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  is_active: boolean;
};

type PromoForm = {
  code: string;
  description: string;
  discountKind: PromoCode['discount_kind'];
  discountValue: string;
  minimumOrderValue: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
};

const initialPromoForm: PromoForm = {
  code: '',
  description: '',
  discountKind: 'percentage',
  discountValue: '',
  minimumOrderValue: '0',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  perCustomerLimit: '',
};

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'object' && cause !== null && 'message' in cause &&
    typeof cause.message === 'string' && cause.message.trim()) {
    const code = 'code' in cause && typeof cause.code === 'string' ? ` [${cause.code}]` : '';
    return `${cause.message}${code}`;
  }
  return fallback;
}

function isEventStatus(value: string): value is StoreEvent['status'] {
  return value === 'draft' || value === 'published' || value === 'cancelled';
}

const initialForm = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  price: '',
  compareAtPrice: '',
  format: 'Paperback',
  coverPath: '',
  stock: '',
  category: '',
  isbn: '',
  isPreorder: false,
  availableOn: '',
  isPublished: true,
  featured: false,
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
const initialPromoFormValue = initialPromoForm;

export function AdminDashboard() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<'books' | 'promos' | 'orders' | 'reviews' | 'events'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [events, setEvents] = useState<StoreEvent[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [promoForm, setPromoForm] = useState<PromoForm>(initialPromoFormValue);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [bookResult, promoResult, orderResult, reviewResult, eventResult] = await Promise.all([
      supabase.from('books').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('id,code,description,discount_kind,discount_value,minimum_order_value,starts_at,expires_at,usage_limit,usage_count,per_customer_limit,is_active').order('created_at', { ascending: false }),
      supabase.from('orders').select('id,order_number,customer_name,customer_email,status,total,currency,created_at,shipping_address').order('created_at', { ascending: false }),
      supabase.from('reviews').select('id,display_name,rating,title,body,status,created_at').order('created_at', { ascending: false }),
      supabase.from('events').select('id,slug,title,summary,starts_at,location_name,status').order('starts_at', { ascending: false }),
    ]);
    if (bookResult.error) throw bookResult.error;
    if (promoResult.error) throw promoResult.error;
    if (orderResult.error) throw orderResult.error;
    if (reviewResult.error) throw reviewResult.error;
    if (eventResult.error) throw eventResult.error;
    setBooks((bookResult.data ?? []) as Book[]);
    setPromos((promoResult.data ?? []) as PromoCode[]);
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
        if (alive) setError(errorMessage(cause, 'Unable to verify administrator access.'));
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [loadData]);

  function clearBookForm() {
    setForm(initialForm);
    setEditingBookId(null);
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  function editBook(book: Book) {
    setEditingBookId(book.id);
    setCoverFile(null);
    setForm({
      title: book.title,
      slug: book.slug,
      subtitle: book.subtitle ?? '',
      description: book.description,
      price: String(book.price),
      compareAtPrice: book.compare_at_price == null ? '' : String(book.compare_at_price),
      format: book.format,
      coverPath: book.cover_path ?? '',
      stock: book.stock_quantity == null ? '' : String(book.stock_quantity),
      category: book.category ?? '',
      isbn: book.isbn ?? '',
      isPreorder: book.is_preorder,
      availableOn: book.available_on ?? '',
      isPublished: book.is_published,
      featured: book.featured,
    });
    setError('');
    setNotice('');
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const price = Number(form.price);
    const compareAtPrice = form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null;
    const stock = form.stock.trim() ? Number(form.stock) : null;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setError('Use a lowercase URL slug with letters, numbers, and single hyphens.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0 ||
      (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)) ||
      (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
      setError('Enter a valid selling price, a higher original price for promotions, and a whole-number stock quantity.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    let uploadedObjectPath: string | null = null;
    let bookSaved = false;
    try {
      let coverPath = form.coverPath.trim() || null;
      if (coverFile) {
        const extensionByType: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
        };
        const extension = extensionByType[coverFile.type];
        if (!extension || coverFile.size > 10 * 1024 * 1024) {
          throw new Error('Choose a JPEG, PNG, or WebP image no larger than 10 MB.');
        }
        const objectPath = `${form.slug.trim()}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('book-covers').upload(objectPath, coverFile, {
          cacheControl: '3600',
          contentType: coverFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedObjectPath = objectPath;
        coverPath = supabase.storage.from('book-covers').getPublicUrl(uploadedObjectPath).data.publicUrl;
      }
      const bookData = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim(),
        price,
        compare_at_price: compareAtPrice,
        currency: 'ZAR',
        format: form.format.trim(),
        cover_path: coverPath,
        stock_quantity: stock,
        category: form.category.trim() || null,
        isbn: form.isbn.trim() || null,
        is_preorder: form.isPreorder,
        available_on: form.availableOn || null,
        is_published: form.isPublished,
        featured: form.featured,
      };
      const result = editingBookId
        ? await supabase.from('books').update(bookData).eq('id', editingBookId)
        : await supabase.from('books').insert(bookData);
      if (result.error) throw result.error;
      bookSaved = true;
      clearBookForm();
      setNotice(editingBookId
        ? 'Book updated. Published changes are now visible in the storefront.'
        : 'Book added to the catalogue. Published books are now available in the storefront.');
      try {
        await loadData();
      } catch (cause) {
        setError(`The book was saved, but the catalogue could not be refreshed: ${errorMessage(cause, 'Unknown error.')}`);
      }
    } catch (cause) {
      if (uploadedObjectPath && !bookSaved) {
        const { error: cleanupError } = await supabase.storage.from('book-covers').remove([uploadedObjectPath]);
        if (cleanupError) console.error('Could not remove an unused book cover upload:', cleanupError.message);
      }
      setError(`Could not save this book: ${errorMessage(cause, 'Unknown database or storage error.')}`);
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
      setError(errorMessage(cause, 'Unable to update book visibility.'));
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
      setError(errorMessage(cause, 'Unable to update order.'));
    }
  }

  async function deleteCancelledOrder(order: Order) {
    if (order.status !== 'cancelled') { setError('Only cancelled orders can be deleted.'); return; }
    if (!window.confirm('Permanently delete cancelled order ' + order.order_number + '? This cannot be undone.')) return;
    setError(''); setNotice('');
    try {
      const { data: { session }, error: authError } = await createClient().auth.getSession();
      if (authError || !session?.access_token) throw authError ?? new Error('Administrator session expired. Sign in again.');
      const response = await fetch('/api/admin/orders/' + encodeURIComponent(order.id), { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.access_token } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to delete this order.');
      await loadData(); setNotice('Cancelled order ' + order.order_number + ' permanently deleted.');
    } catch (cause) { setError(errorMessage(cause, 'Unable to delete cancelled order.')); }
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
      setError(errorMessage(cause, 'Unable to moderate review.'));
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
      setError(errorMessage(cause, 'Unable to save event.'));
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
      setError(errorMessage(cause, 'Unable to update event.'));
    }
  }

  async function addPromoCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const code = promoForm.code.trim().toUpperCase();
    const discountValue = Number(promoForm.discountValue);
    const minimumOrderValue = Number(promoForm.minimumOrderValue);
    const usageLimit = promoForm.usageLimit.trim() ? Number(promoForm.usageLimit) : null;
    const perCustomerLimit = promoForm.perCustomerLimit.trim() ? Number(promoForm.perCustomerLimit) : null;
    const startsAt = promoForm.startsAt ? new Date(promoForm.startsAt) : new Date();
    const expiresAt = promoForm.expiresAt ? new Date(promoForm.expiresAt) : null;
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) {
      setError('Promo codes must be 2–40 characters using letters, numbers, hyphens, or underscores.');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0 ||
      (promoForm.discountKind === 'percentage' && discountValue > 100) ||
      !Number.isFinite(minimumOrderValue) || minimumOrderValue < 0 ||
      (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) ||
      (perCustomerLimit !== null && (!Number.isInteger(perCustomerLimit) || perCustomerLimit <= 0)) ||
      Number.isNaN(startsAt.getTime()) || (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt))) {
      setError('Check the discount, minimum order, usage limits, and date range.');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await createClient().from('promo_codes').insert({
        code,
        description: promoForm.description.trim() || null,
        discount_kind: promoForm.discountKind,
        discount_value: discountValue,
        minimum_order_value: minimumOrderValue,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt?.toISOString() ?? null,
        usage_limit: usageLimit,
        per_customer_limit: perCustomerLimit,
        is_active: true,
      });
      if (insertError) throw insertError;
      setPromoForm(initialPromoFormValue);
      setNotice(`Promo code ${code} added.`);
      try {
        await loadData();
      } catch (cause) {
        setError(`Promo code ${code} was saved, but the list could not be refreshed: ${errorMessage(cause, 'Unknown error.')}`);
      }
    } catch (cause) {
      setError(`Could not save promo code: ${errorMessage(cause, 'Unknown database error.')}`);
    } finally {
      setSaving(false);
    }
  }

  async function setPromoActive(promo: PromoCode, isActive: boolean) {
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await createClient().from('promo_codes')
        .update({ is_active: isActive }).eq('id', promo.id);
      if (updateError) throw updateError;
      setNotice(`${promo.code} ${isActive ? 'activated' : 'deactivated'}.`);
      try {
        await loadData();
      } catch (cause) {
        setError(`${promo.code} was updated, but the list could not be refreshed: ${errorMessage(cause, 'Unknown error.')}`);
      }
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to update promo code.'));
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
      <aside className="surface h-fit p-3">{(['books', 'promos', 'orders', 'reviews', 'events'] as const).map((name) => <button key={name} type="button" onClick={() => setTab(name)} className={`mb-1 block w-full rounded-lg px-4 py-3 text-left text-xs font-bold capitalize ${tab === name ? 'bg-[#581d2b] text-white' : 'text-[#665853] hover:bg-[#f5eee5]'}`}>{name === 'promos' ? 'Promo codes' : name} ({name === 'books' ? books.length : name === 'promos' ? promos.length : name === 'orders' ? orders.length : name === 'reviews' ? reviews.length : events.length})</button>)}
        <p className="mt-3 border-t border-[#e9dfd3] px-3 pt-3 text-[10px] leading-5 text-[#8a7c76]">Changes are saved to the configured Supabase database.</p>
      </aside>
      <section className="surface min-h-[380px] p-5 sm:p-8">
        {tab === 'books' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Books and pre-orders</h2>
          <form onSubmit={saveBook} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold">Book title<input required className="field mt-2" value={form.title} onChange={(event) => {
              const title = event.target.value;
              setForm((current) => ({ ...current, title, slug: current.slug || title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
            }}/></label>
            <label className="text-xs font-bold">URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="field mt-2" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })}/></label>
            <label className="text-xs font-bold">Subtitle<input className="field mt-2" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })}/></label>
            <label className="text-xs font-bold">Selling price (ZAR)<input required type="number" min="0.01" step="0.01" className="field mt-2" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label>
            <label className="text-xs font-bold">Original price for a promotion (ZAR, optional)<input type="number" min="0.01" step="0.01" className="field mt-2" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: event.target.value })}/><span className="mt-1 block font-normal text-[#766b67]">Enter a higher price to show a discount. The price above is the amount charged at checkout.</span></label>
            <label className="text-xs font-bold md:col-span-2">Description<textarea className="field mt-2 min-h-24" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
            <div className="text-xs font-bold">
              <label htmlFor="book-cover-file">Book cover image</label>
              <input
                ref={coverInputRef}
                id="book-cover-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="field mt-2"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
                    setCoverFile(null);
                    event.currentTarget.value = '';
                    setError('Choose a JPEG, PNG, or WebP image no larger than 10 MB.');
                    return;
                  }
                  setError('');
                  setCoverFile(file);
                }}
              />
              <span className="mt-1 block font-normal text-[#766b67]">Choose a file from this device. Maximum 10 MB; JPEG, PNG, and WebP supported.</span>
              {coverFile && <span className="mt-1 block font-normal text-[#581d2b]">Selected: {coverFile.name}</span>}
              {!coverFile && form.coverPath && <img src={form.coverPath} alt="Current book cover" className="mt-3 h-24 w-20 rounded object-cover"/>}
            </div>
            <label className="text-xs font-bold">Format<input required className="field mt-2" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}/></label>
            <label className="text-xs font-bold">Stock quantity (leave blank if unlimited)<input type="number" min="0" step="1" className="field mt-2" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })}/></label>
            <label className="text-xs font-bold">Category (optional)<input className="field mt-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}/></label>
            <label className="text-xs font-bold">ISBN (optional)<input className="field mt-2" value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })}/></label>
            <label className="text-xs font-bold">Sale type<select className="field mt-2" value={form.isPreorder ? 'preorder' : 'standard'} onChange={(event) => setForm({ ...form, isPreorder: event.target.value === 'preorder' })}><option value="standard">Standard sale — available now</option><option value="preorder">Pre-sale / pre-order — fulfil later</option></select></label>
            {form.isPreorder && <label className="text-xs font-bold">Expected fulfilment date (optional)<input type="date" className="field mt-2" value={form.availableOn} onChange={(event) => setForm({ ...form, availableOn: event.target.value })}/></label>}
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })}/> Feature this book in the storefront</label>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })}/> Publish in the storefront immediately</label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : editingBookId ? 'Save book changes' : 'Add book to catalogue'}</button>
              {editingBookId && <button type="button" disabled={saving} onClick={clearBookForm} className="btn btn-outline">Cancel editing</button>}
            </div>
          </form>
          <div className="mt-8 space-y-3">{books.map((book) => {
            const hasPromotion = book.compare_at_price != null && Number(book.compare_at_price) > Number(book.price);
            return <article key={book.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fbf7f0] p-4">
              <div className="flex min-w-0 items-center gap-4">
                <img src={book.cover_path || '/images/book-product.webp'} alt="" className="h-20 w-16 rounded object-cover"/>
                <div><p className="font-semibold">{book.title}</p><p className="mt-1 text-xs text-[#766b67]">{book.currency} {Number(book.price).toFixed(2)}{hasPromotion && ` · Promotion (was ${book.currency} ${Number(book.compare_at_price).toFixed(2)})`} · {book.is_preorder ? `Pre-sale${book.available_on ? ` · expected ${book.available_on}` : ''}` : 'Standard sale'} · {book.is_published ? 'Published' : 'Draft'}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => editBook(book)} className="btn btn-outline !py-2">Edit</button>
                <button type="button" onClick={() => void setPublication(book, !book.is_published)} className="btn btn-outline !py-2">{book.is_published ? 'Unpublish' : 'Publish'}</button>
              </div>
            </article>;
          })}</div>
        </> : tab === 'promos' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Promo codes</h2>
          <p className="mt-2 text-sm text-[#766b67]">Create checkout codes for percentage or fixed-value discounts. Active codes are validated by the server at checkout.</p>
          <form onSubmit={addPromoCode} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold">Code<input required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}" className="field mt-2 uppercase" placeholder="WELCOME10" value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })}/></label>
            <label className="text-xs font-bold">Discount type<select className="field mt-2" value={promoForm.discountKind} onChange={(event) => setPromoForm({ ...promoForm, discountKind: event.target.value as PromoCode['discount_kind'] })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (ZAR)</option></select></label>
            <label className="text-xs font-bold">{promoForm.discountKind === 'percentage' ? 'Discount (%)' : 'Discount (ZAR)'}<input required type="number" min="0.01" max={promoForm.discountKind === 'percentage' ? 100 : undefined} step="0.01" className="field mt-2" value={promoForm.discountValue} onChange={(event) => setPromoForm({ ...promoForm, discountValue: event.target.value })}/></label>
            <label className="text-xs font-bold">Minimum order value (ZAR)<input required type="number" min="0" step="0.01" className="field mt-2" value={promoForm.minimumOrderValue} onChange={(event) => setPromoForm({ ...promoForm, minimumOrderValue: event.target.value })}/></label>
            <label className="text-xs font-bold">Starts at (optional)<input type="datetime-local" className="field mt-2" value={promoForm.startsAt} onChange={(event) => setPromoForm({ ...promoForm, startsAt: event.target.value })}/><span className="mt-1 block font-normal text-[#766b67]">Defaults to now; uses your device timezone.</span></label>
            <label className="text-xs font-bold">Expires at (optional)<input type="datetime-local" className="field mt-2" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })}/></label>
            <label className="text-xs font-bold">Total uses (optional)<input type="number" min="1" step="1" className="field mt-2" value={promoForm.usageLimit} onChange={(event) => setPromoForm({ ...promoForm, usageLimit: event.target.value })}/><span className="mt-1 block font-normal text-[#766b67]">Orders reserve a use until cancelled.</span></label>
            <label className="text-xs font-bold">Uses per reader (optional)<input type="number" min="1" step="1" className="field mt-2" value={promoForm.perCustomerLimit} onChange={(event) => setPromoForm({ ...promoForm, perCustomerLimit: event.target.value })}/></label>
            <label className="text-xs font-bold md:col-span-2">Description (optional)<input maxLength={250} className="field mt-2" value={promoForm.description} onChange={(event) => setPromoForm({ ...promoForm, description: event.target.value })}/></label>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Create promo code'}</button>
            </div>
          </form>
          <div className="mt-8 space-y-3">{promos.length === 0 ? <p className="body-copy text-sm">No promo codes yet.</p> : promos.map((promo) => <article key={promo.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#fbf7f0] p-4">
            <div><p className="font-semibold">{promo.code} · {promo.discount_kind === 'percentage' ? `${Number(promo.discount_value)}% off` : `ZAR ${Number(promo.discount_value).toFixed(2)} off`}</p>
              <p className="mt-1 text-xs text-[#766b67]">{promo.description || `Minimum order ZAR ${Number(promo.minimum_order_value).toFixed(2)}`} · Uses {promo.usage_count}{promo.usage_limit == null ? '' : ` / ${promo.usage_limit}`} · {promo.is_active ? 'Active' : 'Inactive'}{promo.expires_at ? ` · Expires ${new Date(promo.expires_at).toLocaleString()}` : ''}</p>
            </div>
            <button type="button" onClick={() => void setPromoActive(promo, !promo.is_active)} className="btn btn-outline !py-2">{promo.is_active ? 'Deactivate' : 'Activate'}</button>
          </article>)}</div>
        </> : tab === 'orders' ? <>
          <h2 className="font-display text-3xl text-[#581d2b]">Orders and fulfilment</h2>
          <div className="mt-6 space-y-3">{orders.length === 0 ? <p className="body-copy text-sm">No customer orders yet.</p> : orders.map((order) => <article key={order.id} className="rounded-xl bg-[#fbf7f0] p-4">
            <div className="flex flex-wrap justify-between gap-3"><strong>{order.order_number}</strong><strong>{order.currency} {Number(order.total).toFixed(2)}</strong></div>
            <p className="mt-2 text-xs text-[#766b67]">{order.customer_name} · {order.customer_email} · {new Date(order.created_at).toLocaleDateString()}</p><p className="mt-1 text-xs text-[#766b67]">{order.shipping_address?.fulfillment_method === 'pickup' ? 'Local pickup · ' + (order.shipping_address.pickup_location || 'Confirm pickup details') : 'Delivery' + (order.shipping_address?.address ? ' · ' + order.shipping_address.address : '')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-xs capitalize">Status: {order.status}</span><select aria-label={`Update ${order.order_number} status`} className="field max-w-48 !py-2" value={order.status} onChange={(event) => void updateOrder(order, event.target.value)}>
              {['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>{order.status === 'cancelled' && <button type="button" onClick={() => void deleteCancelledOrder(order)} className="btn btn-outline !py-2 text-red-800">Delete cancelled order</button>}</div>
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
