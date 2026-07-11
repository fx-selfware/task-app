import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getUserById } from '@/lib/services/auth';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const auth = requireAuth(request);
    const user = getUserById(getDb(), auth.userId);
    if (!user) return jsonError(404, 'Not found');
    return NextResponse.json({ user });
  });
}
