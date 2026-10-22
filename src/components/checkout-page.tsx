'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib';

type CartLine = { id: string; qty: number };

export function CheckoutPage() {
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [promoCode, setPromoCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session?.access_token) {
        setMessage('Sign in to your reader account before placing an order.');
        setBusy(false);
        return;
      }
      let cart: CartLine[];
      try {
        const saved: unknown = JSON.parse(localStorage.getItem('fff-cart') ?? '[]');
        if (!Array.isArray(saved)) throw new Error('Your bag is invalid. Please review it and try again.');
        cart = saved.map((line) => ({ id: line.id, qty: line.qty }));
      } catch (error) {
        throw error instanceof Error ? error : new Error('Unable to read your bag.');
      }
      if (cart.length === 0 || cart.some((line) => typeof line.id !== 'string' || !Number.isInteger(line.qty))) {
        setMessage('Your bag is empty or contains an invalid item. Please update your bag and try again.');
        setBusy(false);
        return;
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: cart.map(({ id, qty }) => ({ id, quantity: qty })),
          customer: form,
          fulfillmentMethod,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create your order.');
      const paymentForm = document.createElement('form');
      paymentForm.method = 'POST';
      paymentForm.action = result.action;
      Object.entries(result.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        paymentForm.appendChild(input);
      });
      document.body.appendChild(paymentForm);
      paymentForm.submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start secure checkout.');
      setBusy(false);
    }
  }

  return <div className="container section-space max-w-3xl">
    <p className="eyebrow">Secure order details</p><h1 className="heading mt-3">Almost there.</h1>
    <form onSubmit={submit} className="surface mt-8 grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
      <label className="text-xs font-bold">Full name<input required maxLength={150} autoComplete="name" className="field mt-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
      <label className="text-xs font-bold">Phone number<input type="tel" maxLength={40} autoComplete="tel" className="field mt-2" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
      <fieldset className="sm:col-span-2"><legend className="text-xs font-bold">How would you like to receive your book?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${fulfillmentMethod === 'delivery' ? 'border-[#581d2b] bg-[#fbf7f0]' : 'border-[#e9dfd3]'}`}><input type="radio" name="fulfillmentMethod" value="delivery" checked={fulfillmentMethod === 'delivery'} onChange={() => setFulfillmentMethod('delivery')} className="mt-1"/><span><strong className="block text-sm">Delivery</strong><span className="mt-1 block text-xs font-normal text-[#766b67]">Flat shipping fee: R50.00</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${fulfillmentMethod === 'pickup' ? 'border-[#581d2b] bg-[#fbf7f0]' : 'border-[#e9dfd3]'}`}><input type="radio" name="fulfillmentMethod" value="pickup" checked={fulfillmentMethod === 'pickup'} onChange={() => setFulfillmentMethod('pickup')} className="mt-1"/><span><strong className="block text-sm">Local pickup</strong><span className="mt-1 block text-xs font-normal text-[#766b67]">No shipping fee. Pickup details will be confirmed after your order.</span></span></label></div></fieldset>{fulfillmentMethod === 'delivery' && <label className="text-xs font-bold sm:col-span-2">Delivery address<input required maxLength={1000} autoComplete="street-address" className="field mt-2" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })}/></label>}
      <label className="text-xs font-bold sm:col-span-2">Promo code (optional)<input maxLength={40} autoComplete="off" className="field mt-2 uppercase" placeholder="Enter code" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())}/></label>
      <p className="text-xs leading-5 text-[#766b67] sm:col-span-2">Book prices and promo codes are verified against the live catalogue on the server. The final discounted total is shown by PayFast before you pay. Local pickup has no shipping fee. Pre-orders remain pending payment confirmation and are marked for later fulfilment when the publisher enters a release date.</p>
      {message && <div role="alert" className="rounded-lg bg-[#f6efe5] p-3 text-sm leading-5 text-[#694a41] sm:col-span-2">{message}
        {message.toLowerCase().includes('sign in') && <Link href="/login" className="ml-1 font-bold underline">Sign in</Link>}
      </div>}
      <button disabled={busy} className="btn btn-primary sm:col-span-2">{busy ? 'Preparing secure checkout…' : 'Continue securely to PayFast'} <ArrowRight size={16}/></button>
    </form>
  </div>;
}
