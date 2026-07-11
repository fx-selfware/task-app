import { NextRequest, NextResponse } from 'next/server';
import { handle } from '@/lib/apiHandler';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { checkWriteAccess } from '@/lib/services/taskLists';
import { deleteCompletedTasks } from '@/lib/services/tasks';

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const user = requireAuth(request);

    const db = await getDb();
    await checkWriteAccess(db, id, user.userId);
    await deleteCompletedTasks(db, id);
    return new NextResponse(null, { status: 204 });
  });
}
