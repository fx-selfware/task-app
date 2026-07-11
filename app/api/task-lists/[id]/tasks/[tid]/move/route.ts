import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { checkWriteAccess } from '@/lib/services/taskLists';
import { moveTask } from '@/lib/services/tasks';
import { publish } from '@/lib/events';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const { parentId } = (await readJson(request)) as { parentId?: string | null };

    if (parentId === undefined) {
      return jsonError(400, 'parentId is required (string or null)');
    }

    checkWriteAccess(getDb(), id, user.userId);
    const task = moveTask(getDb(), id, tid, parentId);
    publish(id);
    return NextResponse.json({ task });
  });
}
