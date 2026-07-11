import { NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { getDb } from '@/lib/db';

// Readiness probe: opening the DB also runs pending migrations (file: URLs).
export async function GET() {
  return handle(async () => {
    await getDb();
    return NextResponse.json({ ok: true });
  });
}
