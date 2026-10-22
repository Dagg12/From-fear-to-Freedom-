'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient, hasSupabaseConfig } from '@/lib';

type ReaderAffiliate = { id: string; status: 'pending' | 'approved' | 'rejected' | 'suspended'; referral_code: string | null; requested_at: string; admin_note: string | null };
type ReaderSale = { id: string; order_id: string; order_total: number; commission_amount: number; commission_status: string; paid_at: string | null; payment_reference: string | null; order?: { order_number: string; status: string } };

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
  const [affiliate, setAffiliate] = useState<ReaderAffiliate | null>(null);
  const [affiliateSales, setAffiliateSales] = useState<ReaderSale[]>([]);
  const [affiliateBusy, setAffiliateBusy] = useState(false);
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
        const [profileResult, ordersResult, affiliateResult] = await Promise.all([
          supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle(),
          supabase.from('orders').select('id,order_number,status,total,currency,created_at,order_items(title_snapshot,quantity,is_preorder,available_on)').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('affiliate_profiles').select('id,status,referral_code,requested_at,admin_note').eq('user_id', user.id).maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (affiliateResult.error) throw affiliateResult.error;
        let sales: ReaderSale[] = [];
        if (affiliateResult.data) {
          const { data, error: salesError } = await supabase.from('affiliate_referrals').select('id,order_id,order_total,commission_amount,commission_status,paid_at,payment_reference').eq('affiliate_id', affiliateResult.data.id).order('created_at', { ascending: false });
          if (salesError) throw salesError;
          const ids = (data ?? []).map((row) => row.order_id);
          const { data: linkedOrders, error: linkedError } = ids.length ? await supabase.from('orders').select('id,order_number,status').in('id', ids) : { data: [], error: null };
          if (linkedError) throw linkedError;
          sales = (data ?? []).map((row) => ({ ...row, order: (linkedOrders ?? []).find((order) => order.id === row.order_id) })) as ReaderSale[];
        }
        if (alive) {
          setSignedIn(true);
          setEmail(user.email ?? '');
          setName(profileResult.data?.full_name || user.user_metadata?.full_name || '');
          setOrders((ordersResult.data ?? []) as ReaderOrder[]);
          setAffiliate(affiliateResult.data as ReaderAffiliate | null);
          setAffiliateSales(sales);
        }
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : 'Unable to load your account.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function requestAffiliate() {
    setAffiliateBusy(true); setMessage('');
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError ?? new Error('Please sign in again.');
      const now = new Date().toISOString();
      const result = affiliate
        ? await supabase.from('affiliate_profiles').update({ status: 'pending', requested_at: now, referral_code: null, admin_note: null, reviewed_at: null, reviewed_by: null }).eq('id', affiliate.id).eq('user_id', user.id)
        : await supabase.from('affiliate_profiles').insert({ user_id: user.id, status: 'pending', requested_at: now });
      if (result.error) throw result.error;
      const { data, error } = await supabase.from('affiliate_profiles').select('id,status,referral_code,requested_at,admin_note').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      setAffiliate(data as ReaderAffiliate | null);
      setMessage('Your affiliate application has been submitted for Refilwe’s review.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit your affiliate request.'); }
    finally { setAffiliateBusy(false); }
  }

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
      <p className="eyebrow">Share the story</p>
      <h2 className="font-display mt-2 text-2xl text-[#581d2b]">Affiliate programme</h2>
      <p className="body-copy mt-2 text-sm">Apply to share <em>From Fear to Freedom</em>. If approved, you’ll receive a unique referral code and earn R50 per eligible book copy after PayFast confirms payment. Commissions are tracked here; payments are handled manually by the publisher.</p>
      {!affiliate && <button type="button" disabled={affiliateBusy} onClick={() => void requestAffiliate()} className="btn btn-primary mt-5">{affiliateBusy ? 'Submitting…' : 'Apply to become an affiliate'}</button>}
      {affiliate && <div className="mt-5 rounded-xl bg-[#fbf7f0] p-4">
        <p className="text-xs uppercase tracking-wider text-[#766b67]">Application status</p><p className="mt-1 font-semibold capitalize text-[#581d2b]">{affiliate.status}</p>
        {affiliate.status === 'approved' && affiliate.referral_code && <div className="mt-4"><p className="text-xs text-[#766b67]">Your referral code</p><div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-lg border border-[#e9dfd3] bg-white px-4 py-3 text-lg font-bold">{affiliate.referral_code}</code><button type="button" className="btn btn-outline !py-2" onClick={() => { void navigator.clipboard?.writeText(affiliate.referral_code || ''); setMessage('Referral code copied if clipboard access is available.'); }}>Copy code</button></div><p className="mt-2 text-xs text-[#766b67]">Readers can enter this code at checkout.</p></div>}
        {affiliate.admin_note && <p className="mt-3 text-sm text-[#766b67]">Publisher note: {affiliate.admin_note}</p>}
        {affiliate.status === 'rejected' && <button type="button" disabled={affiliateBusy} onClick={() => void requestAffiliate()} className="btn btn-outline mt-4 !py-2">{affiliateBusy ? 'Submitting…' : 'Apply again'}</button>}
        {affiliate.status === 'suspended' && <p className="mt-3 text-sm text-[#766b67]">Your affiliate access is paused. Contact the publisher if you need help.</p>}
      </div>}
      {affiliate?.status === 'approved' && <div className="mt-6"><h3 className="font-display text-xl text-[#581d2b]">Your referred sales and commissions</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#fbf7f0] p-4"><p className="text-xs text-[#766b67]">Payable</p><strong className="text-lg">R{affiliateSales.filter((sale) => sale.commission_status === 'payable').reduce((sum, sale) => sum + Number(sale.commission_amount), 0).toFixed(2)}</strong></div><div className="rounded-xl bg-[#fbf7f0] p-4"><p className="text-xs text-[#766b67]">Paid</p><strong className="text-lg">R{affiliateSales.filter((sale) => sale.commission_status === 'paid').reduce((sum, sale) => sum + Number(sale.commission_amount), 0).toFixed(2)}</strong></div><div className="rounded-xl bg-[#fbf7f0] p-4"><p className="text-xs text-[#766b67]">Voided</p><strong className="text-lg">R{affiliateSales.filter((sale) => sale.commission_status === 'void').reduce((sum, sale) => sum + Number(sale.commission_amount), 0).toFixed(2)}</strong></div></div><div className="mt-4 space-y-3">{affiliateSales.length === 0 ? <p className="body-copy text-sm">No referred sales have been recorded yet.</p> : affiliateSales.map((sale) => <article key={sale.id} className="rounded-xl bg-[#fbf7f0] p-4"><div className="flex flex-wrap justify-between gap-3"><strong>{sale.order?.order_number || 'Referred order'}</strong><strong>R{Number(sale.commission_amount).toFixed(2)}</strong></div><p className="mt-1 text-xs capitalize text-[#766b67]">Order status: {sale.order?.status || 'recorded'} · Commission: {sale.commission_status}</p>{sale.paid_at && <p className="mt-1 text-xs text-[#766b67]">Commission paid {new Date(sale.paid_at).toLocaleDateString()}{sale.payment_reference ? ` · Reference: ${sale.payment_reference}` : ''}</p>}</article>)}</div></div>}
    </section>

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
