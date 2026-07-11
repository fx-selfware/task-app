import { NextRequest, NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listUsers } from '@/lib/services/admin';

export async function GET(request: NextRequest) {
  return handle(async () => {
    requireAdmin(request);
    const users = listUsers(getDb());
    return NextResponse.json({ users });
  });
}
