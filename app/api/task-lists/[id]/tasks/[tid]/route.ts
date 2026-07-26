import { NextRequest, NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTask, updateTask, type UpdateTaskInput } from '@/lib/services/tasks';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as UpdateTaskInput;

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
