import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTemplateShare, updateTemplateShare } from '@/lib/services/template-shares';
import { publish } from '@/lib/events';
import type { Permission } from '@/db/schema';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  return handle(async () => {
    const { id, sid } = await ctx.params;
    const user = requireAuth(request);
    const { permission } = (await readJson(request)) as { permission?: Permission };

    if (!permission) return jsonError(400, 'permission is required');

    const share = updateTemplateShare(getDb(), id, sid, user.userId, permission);
    publish(`template:${id}`);
    return NextResponse.json({ share });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  return handle(async () => {
    const { id, sid } = await ctx.params;
    const user = requireAuth(request);

    deleteTemplateShare(getDb(), id, sid, user.userId);
    publish(`template:${id}`);
    return new NextResponse(null, { status: 204 });
  });
}
