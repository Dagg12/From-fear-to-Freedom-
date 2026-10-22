import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient, getBearerToken } from '@/lib/server-supabase';

type CartLine = { id: string; quantity: number };
type CheckoutRequest = {
  items?: unknown[];
  customer?: { name?: string; phone?: string; address?: string };
  fulfillmentMethod?: 'delivery' | 'pickup';
  promoCode?: string;
  affiliateCode?: string;
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
    (value.fulfillmentMethod === undefined || value.fulfillmentMethod === 'delivery' || value.fulfillmentMethod === 'pickup') &&
    (value.promoCode === undefined || typeof value.promoCode === 'string') &&
    (value.affiliateCode === undefined || typeof value.affiliateCode === 'string');
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
  // PayFast custom payment-form signatures use the documented field order,
  // not alphabetical order (alphabetical sorting is for PayFast's separate API).
  const fieldOrder = [
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    'notify_method', 'name_first', 'name_last', 'email_address', 'cell_number',
    'm_payment_id', 'amount', 'item_name', 'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation', 'confirmation_address', 'currency', 'payment_method',
    'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
    'subscription_notify_email', 'subscription_notify_webhook', 'subscription_notify_buyer',
  ];
  const payload = fieldOrder
    .filter((key) => fields[key] !== undefined && fields[key] !== '')
    .map((key) => `${key}=${encode(fields[key])}`)
    .join('&');
  return createHash('md5')
    .update(passphrase ? `${payload}&passphrase=${encode(passphrase)}` : payload)
    .digest('hex');
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
  const fulfillmentMethod = input.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery';
  const token = getBearerToken(request);
  if (!token || !input.customer?.name?.trim() ||
    (fulfillmentMethod === 'delivery' && !input.customer.address?.trim()) ||
    input.customer.name.trim().length > 150 || (input.customer.address?.trim().length ?? 0) > 1000 ||
    (input.customer.phone?.trim().length ?? 0) > 40 ||
    (input.promoCode?.trim().length ?? 0) > 40 || (input.affiliateCode?.trim().length ?? 0) > 40 ||
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
    p_shipping_address: fulfillmentMethod === 'pickup'
      ? { fulfillment_method: 'pickup', address: null, pickup_location: process.env.BOOK_PICKUP_LOCATION?.trim() || 'Pickup details will be confirmed by email.' }
      : { fulfillment_method: 'delivery', address: input.customer.address.trim().slice(0, 1000) },
    p_shipping_total: fulfillmentMethod === 'pickup' ? 0 : shippingAmount,
    p_items: [...quantities].map(([id, quantity]) => ({ id, quantity })),
    p_promo_code: input.promoCode?.trim() || null,
    p_affiliate_code: input.affiliateCode?.trim() || null,
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
  // Email failures must not block checkout after the order is safely recorded.
  const adminEmail = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (adminEmail && resendApiKey && fromEmail) {
    const orderSummary = orderItems.map((item) => item.title_snapshot).join(', ');
    const fulfillmentLabel = fulfillmentMethod === 'pickup'
      ? `Pickup — ${process.env.BOOK_PICKUP_LOCATION?.trim() || 'details to be confirmed'}`
      : `Delivery to: ${input.customer.address.trim()}`;
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail, to: [adminEmail], subject: `New book order ${order.order_number}`,
          text: [
            'A new order has been placed on the Refilwe Mogale website.',
            `Order: ${order.order_number}`, `Customer: ${input.customer.name.trim()}`,
            `Email: ${user.email}`, `Phone: ${input.customer.phone?.trim() || 'Not provided'}`,
            `Fulfilment: ${fulfillmentLabel}`, `Books: ${orderSummary}`,
            `Total: ZAR ${Number(order.total).toFixed(2)}`,
            'Payment status: pending PayFast confirmation', `Admin dashboard: ${base}/admin`,
          ].join('\n'),
        }),
        cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (!emailResponse.ok) console.error('Order notification email was rejected by the email provider:', emailResponse.status);
    } catch (emailError) { console.error('Could not send new-order notification email:', emailError); }
  } else { console.warn('Order notification email is not configured; set ADMIN_ORDER_NOTIFICATION_EMAIL, RESEND_API_KEY, and RESEND_FROM_EMAIL.'); }

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
