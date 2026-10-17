import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

// This endpoint creates a PayFast redirect for the fixed catalogue product.
// Do not accept a client-supplied price. Add server-side order persistence and ITN signature validation before live launch.
const PRODUCT_PRICE = 320;
function encode(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}
function signature(fields: Record<string, string>, passphrase: string) {
  const payload = Object.keys(fields).filter((key) => fields[key] !== '' && key !== 'signature')
    .sort().map((key) => `${key}=${encode(fields[key])}`).join('&');
  return createHash('md5').update(passphrase ? `${payload}&passphrase=${encode(passphrase)}` : payload).digest('hex');
}
export async function POST(request: Request) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!merchantId || !merchantKey || !siteUrl) {
    return NextResponse.json({ error: 'PayFast is not configured on the server yet.' }, { status: 503 });
  }
  let customer: { name?: string; email?: string };
  try { customer = await request.json(); } catch { return NextResponse.json({ error: 'Invalid checkout request.' }, { status: 400 }); }
  if (!customer.email || !/^\S+@\S+\.\S+$/.test(customer.email) || !customer.name?.trim()) {
    return NextResponse.json({ error: 'A valid name and email are required.' }, { status: 400 });
  }
  const base = siteUrl.replace(/\/$/, '');
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${base}/checkout?payment=return`,
    cancel_url: `${base}/cart?payment=cancelled`,
    notify_url: `${base}/api/payfast/notify`,
    name_first: customer.name.trim().slice(0, 100),
    email_address: customer.email.trim().slice(0, 100),
    m_payment_id: `FFF-${Date.now()}`,
    amount: PRODUCT_PRICE.toFixed(2),
    item_name: 'From Fear to Freedom',
    item_description: 'From Fear to Freedom book order',
  };
  fields.signature = signature(fields, passphrase);
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return NextResponse.json({ action: sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process', fields });
}
