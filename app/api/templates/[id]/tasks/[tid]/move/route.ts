import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { moveTemplateTask } from '@/lib/services/templates';
import { publish } from '@/lib/events';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const { parentId } = (await readJson(request)) as { parentId?: string | null };

    if (parentId === undefined) {
      return jsonError(400, 'parentId is required (string or null)');
    }

    const task = moveTemplateTask(getDb(), id, tid, user.userId, parentId);
    publish(`template:${id}`);
    return NextResponse.json({ task });
  });
}
