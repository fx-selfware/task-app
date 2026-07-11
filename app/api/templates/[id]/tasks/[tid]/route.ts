import { NextRequest, NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteTemplateTask, updateTemplateTask, type UpdateTemplateTaskInput } from '@/lib/services/templates';
import { publish } from '@/lib/events';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);
    const body = (await readJson(request)) as UpdateTemplateTaskInput;

    const task = updateTemplateTask(getDb(), id, tid, user.userId, body);
    publish(`template:${id}`);
    return NextResponse.json({ task });
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);

    deleteTemplateTask(getDb(), id, tid, user.userId);
    publish(`template:${id}`);
    return new NextResponse(null, { status: 204 });
  });
}
