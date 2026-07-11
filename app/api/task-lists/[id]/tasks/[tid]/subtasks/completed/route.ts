import { NextRequest, NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { checkWriteAccess } from '@/lib/services/taskLists';
import { deleteCompletedSubtasks } from '@/lib/services/tasks';
import { publish } from '@/lib/events';

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string; tid: string }> }) {
  return handle(async () => {
    const { id, tid } = await ctx.params;
    const user = requireAuth(request);

    checkWriteAccess(getDb(), id, user.userId);
    deleteCompletedSubtasks(getDb(), id, tid);
    publish(id);
    return new NextResponse(null, { status: 204 });
  });
}
