import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { moveTemplateTask } from '@/lib/services/templates';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const { parentId } = (await readJson(request)) as { parentId?: string | null };

    if (parentId === undefined) {
      return jsonError(400, 'parentId is required (string or null)');
    }

    const db = await getDb();
    const task = await moveTemplateTask(db, id, tid, user.userId, parentId);
    return NextResponse.json({ task });
  });
}
