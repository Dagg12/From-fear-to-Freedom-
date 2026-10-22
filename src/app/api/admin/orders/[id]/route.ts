import { NextResponse } from 'next/server';
import { createServiceClient, getBearerToken } from '@/lib/server-supabase';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Administrator sign-in is required.' }, { status: 401 });
  const supabase = createServiceClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.is_admin) return NextResponse.json({ error: 'Only administrators can delete orders.' }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 });
  const { data: order, error: lookupError } = await supabase.from('orders').select('id,status').eq('id', id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Could not verify the order.' }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'cancelled') return NextResponse.json({ error: 'Only cancelled orders may be deleted.' }, { status: 409 });
  const { error: deleteError } = await supabase.from('orders').delete().eq('id', id).eq('status', 'cancelled');
  if (deleteError) {
    console.error('Could not delete cancelled order:', deleteError.message);
    return NextResponse.json({ error: 'Could not delete this order. Check whether related order records prevent deletion.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
