import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { reorderTasks } from '@/lib/services/tasks';

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { orderedIds, parentId } = (await readJson(request)) as {
      orderedIds?: unknown;
      parentId?: string | null;
    };

    if (!Array.isArray(orderedIds)) {
      return jsonError(400, 'orderedIds must be an array');
    }

    const db = await getDb();
    await reorderTasks(db, id, user.userId, orderedIds as string[], parentId ?? null);
    return NextResponse.json({ ok: true });
  });
}
