'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, hasSupabaseConfig } from '@/lib';

type ReaderOrder = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  order_items: { title_snapshot: string; quantity: number; is_preorder: boolean; available_on: string | null }[];
};

export function AccountDashboard() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orders, setOrders] = useState<ReaderOrder[]>([]);
  const [message, setMessage] = useState('');
  const [paymentReturn, setPaymentReturn] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setPaymentReturn(new URLSearchParams(window.location.search).get('payment') === 'return');
    if (!hasSupabaseConfig()) {
      setMessage('Reader accounts are unavailable until Supabase is configured.');
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (alive) setLoading(false);
          return;
        }
        const [profileResult, ordersResult] = await Promise.all([
          supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle(),
          supabase.from('orders').select('id,order_number,status,total,currency,created_at,order_items(title_snapshot,quantity,is_preorder,available_on)').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (alive) {
          setSignedIn(true);
          setEmail(user.email ?? '');
          setName(profileResult.data?.full_name || user.user_metadata?.full_name || '');
          setOrders((ordersResult.data ?? []) as ReaderOrder[]);
        }
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : 'Unable to load your account.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setSignedIn(false);
    setEmail('');
    setName('');
    setOrders([]);
  }

  if (loading) return <div className="container section-space"><p role="status" className="body-copy">Loading your reader account…</p></div>;
  if (!signedIn) return <div className="container section-space max-w-xl"><div className="surface p-7 sm:p-10">
    <p className="eyebrow">Your space</p><h1 className="heading mt-3">Reader dashboard.</h1>
    <h2 className="font-display mt-6 text-2xl text-[#581d2b]">Sign in to view your account</h2>
    <p className="body-copy mt-2 text-sm">Your registered profile and orders will appear here after you sign in.</p>
    {message && <p role="alert" className="mt-4 text-sm text-red-800">{message}</p>}
    <Link href="/login" className="btn btn-primary mt-5">Sign in to your account</Link>
  </div></div>;

  return <div className="container section-space">
    <p className="eyebrow">Your space</p><h1 className="heading mt-3">Reader dashboard.</h1>
    <div className="surface mt-7 flex flex-wrap items-center justify-between gap-4 p-6">
      <div><h2 className="font-display text-2xl text-[#581d2b]">{name || 'Welcome back'}</h2><p className="mt-1 text-sm text-[#766b67]">{email}</p></div>
      <button type="button" onClick={signOut} className="btn btn-outline">Sign out</button>
    </div>
    {message && <p role="alert" className="mt-4 text-sm text-red-800">{message}</p>}
    <section className="surface mt-6 p-6 sm:p-8">
      <h2 className="font-display text-2xl text-[#581d2b]">Your orders</h2>
      {paymentReturn && <p role="status" className="mt-4 rounded-lg bg-[#f6efe5] p-3 text-sm text-[#694a41]">Your browser returned from PayFast. Payment is not confirmed until the verified notification appears in your order status.</p>}
      {orders.length === 0 ? <p className="body-copy mt-4 text-sm">You are signed in. There are no orders linked to this account yet.</p> :
        <div className="mt-5 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl bg-[#fbf7f0] p-4">
          <div className="flex flex-wrap justify-between gap-3"><strong>{order.order_number}</strong><span>{order.currency} {Number(order.total).toFixed(2)}</span></div>
          <p className="mt-2 text-xs capitalize text-[#766b67]">{order.status} · {new Date(order.created_at).toLocaleDateString()}</p>
          <ul className="mt-3 space-y-1 text-xs">{order.order_items?.map((item, index) => <li key={`${order.id}-${index}`}>{item.title_snapshot} × {item.quantity}{item.is_preorder ? ` · Pre-order${item.available_on ? `, expected ${item.available_on}` : ''}` : ''}</li>)}</ul>
        </article>)}</div>}
      <Link href="/shop" className="btn btn-primary mt-6">Browse the bookstore</Link>
    </section>
  </div>;
}
