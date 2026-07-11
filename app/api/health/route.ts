import { NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { getDb } from '@/lib/db';

// Readiness probe: opening the DB also runs pending migrations.
export async function GET() {
  return handle(async () => {
    getDb();
    return NextResponse.json({ ok: true });
  });
}
