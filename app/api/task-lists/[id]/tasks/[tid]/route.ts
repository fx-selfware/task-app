import { NextRequest, NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { checkWriteAccess } from '@/lib/services/taskLists';
import { deleteTask, updateTask, type UpdateTaskInput } from '@/lib/services/tasks';
import { publish } from '@/lib/events';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as UpdateTaskInput;

    checkWriteAccess(getDb(), id, user.userId);
    const task = updateTask(getDb(), id, tid, body);
    publish(id);
    return NextResponse.json({ task });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);

    checkWriteAccess(getDb(), id, user.userId);
    deleteTask(getDb(), id, tid);
    publish(id);
    return new NextResponse(null, { status: 204 });
  });
}
