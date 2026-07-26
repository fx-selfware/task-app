import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTask, updateTask, type UpdateTaskInput } from '@/lib/services/tasks';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as UpdateTaskInput;
    // readJson casts without checking, and $type<TaskStatus>() is compile-time
    // only — an arbitrary status would store a task that is neither TODO nor
    // DONE, invisible to "delete completed" and impossible to un-complete.
    if (body.status !== undefined && body.status !== 'TODO' && body.status !== 'DONE') {
      return jsonError(400, 'status must be TODO or DONE');
    }

    const db = await getDb();
    const task = await updateTask(db, id, user.userId, tid, body);
    return NextResponse.json({ task });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);

    const db = await getDb();
    await deleteTask(db, id, user.userId, tid);
    return new NextResponse(null, { status: 204 });
  });
}
