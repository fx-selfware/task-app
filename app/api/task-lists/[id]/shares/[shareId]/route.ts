import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteShare, updateShare } from '@/lib/services/shares';
import { publish } from '@/lib/events';
import type { Permission } from '@/db/schema';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; shareId: string }> }) {
  return handle(async () => {
    const { id, shareId } = await ctx.params;
    const user = requireAuth(request);
    const { permission } = (await readJson(request)) as { permission?: Permission };

    if (!permission) return jsonError(400, 'permission is required');

    const share = updateShare(getDb(), id, shareId, user.userId, permission);
    publish(id);
    return NextResponse.json({ share });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; shareId: string }> }) {
  return handle(async () => {
    const { id, shareId } = await ctx.params;
    const user = requireAuth(request);

    deleteShare(getDb(), id, shareId, user.userId);
    publish(id);
    return new NextResponse(null, { status: 204 });
  });
}
