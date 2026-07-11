import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteShare, updateShare } from '@/lib/services/shares';
import type { Permission } from '@/db/schema';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; shareId: string }> }) {
  return handle(async () => {
    const { id, shareId } = await ctx.params;
    const user = requireAuth(request);
    const { permission } = (await readJson(request)) as { permission?: Permission };

    if (!permission) return jsonError(400, 'permission is required');

    const db = await getDb();
    const share = await updateShare(db, id, shareId, user.userId, permission);
    return NextResponse.json({ share });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; shareId: string }> }) {
  return handle(async () => {
    const { id, shareId } = await ctx.params;
    const user = requireAuth(request);

    const db = await getDb();
    await deleteShare(db, id, shareId, user.userId);
    return new NextResponse(null, { status: 204 });
  });
}
