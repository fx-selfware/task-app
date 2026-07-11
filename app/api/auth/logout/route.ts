import { NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';

export async function POST() {
  return handle(async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set('token', '', { path: '/', maxAge: 0 });
    return response;
  });
}
