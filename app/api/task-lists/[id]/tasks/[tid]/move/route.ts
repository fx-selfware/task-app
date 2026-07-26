import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { moveTask } from '@/lib/services/tasks';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const { parentId } = (await readJson(request)) as { parentId?: string | null };

    if (parentId === undefined) {
      return jsonError(400, 'parentId is required (string or null)');
    }

    const db = await getDb();
    const task = await moveTask(db, id, user.userId, tid, parentId);
    return NextResponse.json({ task });
  });
}
