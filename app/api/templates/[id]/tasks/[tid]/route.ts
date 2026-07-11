import { NextRequest, NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTemplateTask, updateTemplateTask, type UpdateTemplateTaskInput } from '@/lib/services/templates';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as UpdateTemplateTaskInput;

    const db = await getDb();
    const task = await updateTemplateTask(db, id, tid, user.userId, body);
    return NextResponse.json({ task });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);

    const db = await getDb();
    await deleteTemplateTask(db, id, tid, user.userId);
    return new NextResponse(null, { status: 204 });
  });
}
