import { NextRequest, NextResponse } from 'next/server';
import { handle, jsonError, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTaskList, getTaskListWithAccess, updateTaskList } from '@/lib/services/taskLists';
import { publish } from '@/lib/events';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { list, isOwner, permission } = getTaskListWithAccess(getDb(), id, user.userId);
    return NextResponse.json({ list, isOwner, permission });
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    const { name } = (await readJson(request)) as { name?: string };
    if (!name) return jsonError(400, 'name is required');

    const list = updateTaskList(getDb(), id, user.userId, name);
    publish(id);
    return NextResponse.json({ list });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);
    deleteTaskList(getDb(), id, user.userId);
    publish(id);
    return new NextResponse(null, { status: 204 });
  });
}
