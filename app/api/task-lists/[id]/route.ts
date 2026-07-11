import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTaskList, getTaskListWithAccess, updateTaskList } from '@/lib/services/taskLists';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const db = await getDb();
    const { list, isOwner, permission } = await getTaskListWithAccess(db, id, user.userId);
    return NextResponse.json({ list, isOwner, permission });
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { name } = (await readJson(request)) as { name?: string };
    if (!name) return jsonError(400, 'name is required');

    const db = await getDb();
    const list = await updateTaskList(db, id, user.userId, name);
    return NextResponse.json({ list });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const db = await getDb();
    await deleteTaskList(db, id, user.userId);
    return new NextResponse(null, { status: 204 });
  });
}
