import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient, getBearerToken } from '@/lib/server-supabase';

type CartLine = { id: string; quantity: number };
type CheckoutRequest = {
  items?: unknown[];
  customer?: { name?: string; phone?: string; address?: string };
  promoCode?: string;
};
type CreatedOrder = { id: string; order_number: string; total: number | string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCheckoutRequest(value: unknown): value is CheckoutRequest {
  if (!isRecord(value) || !isRecord(value.customer) || !Array.isArray(value.items)) return false;
  return typeof value.customer.name === 'string' &&
    typeof value.customer.address === 'string' &&
    (value.customer.phone === undefined || typeof value.customer.phone === 'string') &&
    (value.promoCode === undefined || typeof value.promoCode === 'string');
}

function isCartLine(value: unknown): value is CartLine {
  return isRecord(value) && typeof value.id === 'string' && typeof value.quantity === 'number';
}

function isCreatedOrder(value: unknown): value is CreatedOrder {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'order_number' in value && typeof value.order_number === 'string' &&
    'total' in value && (typeof value.total === 'number' || typeof value.total === 'string');
}

function encode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function sign(fields: Record<string, string>, passphrase: string) {
  const payload = Object.keys(fields).filter((key) => fields[key] !== '' && key !== 'signature')
    .sort().map((key) => `${key}=${encode(fields[key])}`).join('&');
  return createHash('md5').update(passphrase ? `${payload}&passphrase=${encode(passphrase)}` : payload).digest('hex');
}

export async function POST(request: Request) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const shippingAmount = Number(process.env.BOOK_SHIPPING_ZAR);
  const missingConfiguration = [
    !merchantId && 'PAYFAST_MERCHANT_ID',
    !merchantKey && 'PAYFAST_MERCHANT_KEY',
    !siteUrl && 'NEXT_PUBLIC_SITE_URL',
    !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter((variable): variable is string => Boolean(variable));
  if (!merchantId || !merchantKey || !siteUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: `Secure checkout is not configured. Missing: ${missingConfiguration.join(', ')}.` }, { status: 503 });
  }
  if (!process.env.BOOK_SHIPPING_ZAR || !Number.isFinite(shippingAmount) || shippingAmount < 0) {
    return NextResponse.json({ error: 'Secure checkout is unavailable until the store configures a valid flat shipping amount.' }, { status: 503 });
  }
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL must be a valid absolute URL.' }, { status: 503 });
  }
  if (process.env.NODE_ENV === 'production' && site.protocol !== 'https:') {
    return NextResponse.json({ error: 'Secure checkout requires an HTTPS NEXT_PUBLIC_SITE_URL in production.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    return NextResponse.json({ error: 'The order request is too large.' }, { status: 413 });
  }
  let parsed: unknown;
  try {
    const body = await request.text();
    if (body.length > 16_000) return NextResponse.json({ error: 'The order request is too large.' }, { status: 413 });
    parsed = JSON.parse(body) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid order request.' }, { status: 400 });
  }
  if (!isCheckoutRequest(parsed)) return NextResponse.json({ error: 'Invalid order request.' }, { status: 400 });
  const input = parsed;
  const token = getBearerToken(request);
  if (!token || !input.customer?.name?.trim() || !input.customer.address?.trim() ||
    input.customer.name.trim().length > 150 || input.customer.address.trim().length > 1000 ||
    (input.customer.phone?.trim().length ?? 0) > 40 ||
    (input.promoCode?.trim().length ?? 0) > 40 ||
    !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 20) {
    return NextResponse.json({ error: 'Sign in and provide your name, delivery address, and at least one book.' }, { status: 400 });
  }
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    if (!isCartLine(line) || !/^[0-9a-f-]{36}$/i.test(line.id) ||
      !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      return NextResponse.json({ error: 'The cart contains an invalid book or quantity.' }, { status: 400 });
    }
    quantities.set(line.id, (quantities.get(line.id) ?? 0) + line.quantity);
    if ((quantities.get(line.id) ?? 0) > 20) {
      return NextResponse.json({ error: 'A maximum of 20 copies per book may be ordered at once.' }, { status: 400 });
    }
  }
  const supabase = createServiceClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Your session has expired. Sign in again to check out.' }, { status: 401 });
  }
  const base = siteUrl.replace(/\/$/, '');
  const { data: orderData, error: orderError } = await supabase.rpc('create_checkout_order', {
    p_user_id: user.id,
    p_customer_name: input.customer.name.trim().slice(0, 150),
    p_customer_email: user.email,
    p_customer_phone: input.customer.phone?.trim().slice(0, 40) ?? null,
    p_shipping_address: { address: input.customer.address.trim().slice(0, 1000) },
    p_shipping_total: shippingAmount,
    p_items: [...quantities].map(([id, quantity]) => ({ id, quantity })),
    p_promo_code: input.promoCode?.trim() || null,
  }).maybeSingle();
  if (orderError || !isCreatedOrder(orderData)) {
    console.error('Unable to create checkout order:', orderError?.message);
    return NextResponse.json(
      { error: orderError?.code === 'P0001' ? orderError.message : 'Unable to create this order right now.' },
      { status: orderError?.code === 'P0001' ? 400 : 500 },
    );
  }
  const order = orderData;
  const { data: orderItems, error: itemsError } = await supabase.from('order_items')
    .select('title_snapshot').eq('order_id', order.id);
  if (itemsError || !orderItems) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    console.error('Unable to read checkout order items:', itemsError?.message);
    return NextResponse.json({ error: 'Unable to finish checkout. Please try again.' }, { status: 500 });
  }
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${base}/account?payment=return`,
    cancel_url: `${base}/checkout?payment=cancelled`,
    notify_url: `${base}/api/payfast/notify`,
    name_first: input.customer.name.trim().slice(0, 100),
    email_address: user.email,
    m_payment_id: order.id,
    amount: Number(order.total).toFixed(2),
    item_name: `Book order ${order.order_number}`,
    item_description: orderItems.map((item) => item.title_snapshot).join(', ').slice(0, 255),
  };
  fields.signature = sign(fields, process.env.PAYFAST_PASSPHRASE ?? '');
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return NextResponse.json({
    orderId: order.id,
    action: sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process',
    fields,
  });
}
