import { NextResponse } from 'next/server';

// Deliberately fail closed: payment status must not be updated until PayFast ITN
// source validation, signature verification, amount matching and database persistence are implemented.
export async function POST() {
  return NextResponse.json({ error: 'Payment notifications are not enabled until verified order persistence is configured.' }, { status: 501 });
}
