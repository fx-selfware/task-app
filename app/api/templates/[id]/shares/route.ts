import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTemplateShare, getTemplateShares } from '@/lib/services/template-shares';
import { publish } from '@/lib/events';
import type { Permission } from '@/db/schema';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const shares = getTemplateShares(getDb(), id, user.userId);
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

    const share = createTemplateShare(getDb(), id, user.userId, email, perm);
    publish(`template:${id}`);
    return NextResponse.json({ share }, { status: 201 });
  });
}
