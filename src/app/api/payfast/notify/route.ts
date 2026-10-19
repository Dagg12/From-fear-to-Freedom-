import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/server-supabase';

function encode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function signature(fields: Record<string, string>, passphrase: string) {
  const payload = Object.keys(fields).filter((key) => key !== 'signature' && fields[key] !== '')
    .sort().map((key) => `${key}=${encode(fields[key])}`).join('&');
  return createHash('md5').update(passphrase ? `${payload}&passphrase=${encode(passphrase)}` : payload).digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  if (!merchantId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('PayFast ITN is missing server configuration.');
    return new NextResponse('ITN server configuration is incomplete.', { status: 503 });
  }
  const rawBody = await request.text();
  if (rawBody.length > 32_000) return new NextResponse('Invalid notification.', { status: 400 });
  const params = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key in fields) return new NextResponse('Duplicate notification field.', { status: 400 });
    fields[key] = value;
  }
  if (!fields.signature || !fields.m_payment_id || !fields.amount_gross ||
    !fields.merchant_id || !fields.payment_status || !fields.pf_payment_id ||
    fields.merchant_id !== merchantId) {
    return new NextResponse('Invalid notification fields.', { status: 400 });
  }
  const expectedSignature = signature(fields, process.env.PAYFAST_PASSPHRASE ?? '');
  if (!safeEqual(fields.signature, expectedSignature)) {
    return new NextResponse('Invalid notification signature.', { status: 400 });
  }
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  const validationUrl = sandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://api.payfast.co.za/eng/query/validate';
  let validation: Response;
  let validationBody: string;
  try {
    validation = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    validationBody = await validation.text();
  } catch (error) {
    console.error('Could not validate PayFast notification:', error);
    return new NextResponse('Notification validation unavailable.', { status: 503 });
  }
  if (!validation.ok || validationBody.trim() !== 'VALID') {
    return new NextResponse('Notification validation failed.', { status: 400 });
  }
  if (!['COMPLETE', 'CANCELLED', 'FAILED'].includes(fields.payment_status)) {
    return new NextResponse('Notification received; payment is not complete.', { status: 200 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(fields.m_payment_id)) {
    return new NextResponse('Invalid order reference.', { status: 400 });
  }
  const supabase = createServiceClient();
  const { data: order, error: orderError } = await supabase.from('orders')
    .select('id,total,status,payment_provider,payment_reference')
    .eq('id', fields.m_payment_id).single();
  if (orderError || !order || order.payment_provider !== 'payfast') {
    console.error('PayFast notification references an unknown order:', orderError?.message);
    return new NextResponse('Order not found.', { status: 404 });
  }
  const paidAmount = Number(fields.amount_gross);
  if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== Math.round(Number(order.total) * 100)) {
    console.error(`PayFast amount mismatch for order ${order.id}.`);
    return new NextResponse('Payment amount mismatch.', { status: 400 });
  }
  if (fields.payment_status === 'CANCELLED' || fields.payment_status === 'FAILED') {
    if (order.status === 'cancelled') return new NextResponse('OK', { status: 200 });
    if (order.status !== 'pending') return new NextResponse('Order is not awaiting payment.', { status: 409 });
    const { error: cancelError } = await supabase.from('orders').update({ status: 'cancelled' })
      .eq('id', order.id).eq('status', 'pending');
    if (cancelError) {
      console.error('Could not cancel unpaid PayFast order:', cancelError.message);
      return new NextResponse('Unable to record payment status.', { status: 503 });
    }
    return new NextResponse('OK', { status: 200 });
  }
  if (order.status === 'paid' && order.payment_reference === fields.pf_payment_id) {
    return new NextResponse('OK', { status: 200 });
  }
  if (order.status !== 'pending') {
    return new NextResponse('Order is not awaiting payment.', { status: 409 });
  }
  const { data: updated, error: updateError } = await supabase.from('orders').update({
    status: 'paid',
    payment_reference: fields.pf_payment_id,
    paid_at: new Date().toISOString(),
  }).eq('id', order.id).eq('status', 'pending').select('id').maybeSingle();
  if (updateError || !updated) {
    console.error('Could not mark PayFast order as paid:', updateError?.message);
    return new NextResponse('Unable to record payment.', { status: 503 });
  }
  return new NextResponse('OK', { status: 200 });
}
