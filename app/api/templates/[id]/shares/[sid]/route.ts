import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTemplateShare, updateTemplateShare } from '@/lib/services/template-shares';
import type { Permission } from '@/db/schema';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  return handle(async () => {
    const { id, sid } = await ctx.params;
    const user = requireAuth(request);
    const { permission } = (await readJson(request)) as { permission?: Permission };

    if (!permission) return jsonError(400, 'permission is required');

    const db = await getDb();
    const share = await updateTemplateShare(db, id, sid, user.userId, permission);
    return NextResponse.json({ share });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  return handle(async () => {
    const { id, sid } = await ctx.params;
    const user = requireAuth(request);

    const db = await getDb();
    await deleteTemplateShare(db, id, sid, user.userId);
    return new NextResponse(null, { status: 204 });
  });
}
