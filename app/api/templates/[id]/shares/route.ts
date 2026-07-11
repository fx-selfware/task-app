import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTemplateShare, getTemplateShares } from '@/lib/services/template-shares';
import type { Permission } from '@/db/schema';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const db = await getDb();
    const shares = await getTemplateShares(db, id, user.userId);
    return NextResponse.json({ shares });
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { email, permission } = (await readJson(request)) as { email?: string; permission?: Permission };

    if (!email) return jsonError(400, 'email is required');
    const perm: Permission = permission === 'WRITE' ? 'WRITE' : 'READ';

    const db = await getDb();
    const share = await createTemplateShare(db, id, user.userId, email, perm);
    return NextResponse.json({ share }, { status: 201 });
  });
}
