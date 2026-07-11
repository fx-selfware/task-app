import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { taskLists, taskListShares, tasks, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

async function getTaskCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ taskListId: tasks.taskListId, count: sql<number>`count(*)` })
    .from(tasks)
    .groupBy(tasks.taskListId)
    .all();
  return new Map(rows.map((r) => [r.taskListId, r.count]));
}

export async function getTaskLists(db: Db, userId: string) {
  const ownedRows = await db
    .select()
    .from(taskLists)
    .where(eq(taskLists.ownerId, userId))
    .orderBy(asc(taskLists.createdAt))
    .all();

  const sharedRows = await db
    .select({ list: taskLists, permission: taskListShares.permission })
    .from(taskLists)
    .innerJoin(
      taskListShares,
      and(eq(taskListShares.taskListId, taskLists.id), eq(taskListShares.userId, userId)),
    )
    .orderBy(asc(taskLists.createdAt))
    .all();

  const counts = await getTaskCounts(db);

  const owned = ownedRows.map((l) => ({
    ...l,
    _count: { tasks: counts.get(l.id) ?? 0 },
    role: 'owner' as const,
  }));

  const shared = sharedRows.map(({ list, permission }) => ({
    ...list,
    _count: { tasks: counts.get(list.id) ?? 0 },
    shares: [{ permission }],
    role: 'shared' as const,
    permission: permission ?? 'READ',
  }));

  return { owned, shared };
}

export async function createTaskList(db: Db, userId: string, name: string) {
  return await db.insert(taskLists).values({ name, ownerId: userId }).returning().get();
}

export async function getTaskListWithAccess(db: Db, listId: string, userId: string) {
  const listRow = await db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');

  const shareRows = await db.select().from(taskListShares).where(eq(taskListShares.taskListId, listId)).all();
  const isOwner = listRow.ownerId === userId;
  const myShare = shareRows.find((s) => s.userId === userId);
  if (!isOwner && !myShare) httpError(404, 'Not found');

  const permission: Permission = isOwner ? 'WRITE' : (myShare?.permission ?? 'READ');

  const owner = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, listRow.ownerId))
    .get();

  const shareUserIds = shareRows.map((s) => s.userId);
  const shareUsers =
    shareUserIds.length > 0
      ? await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, shareUserIds))
          .all()
      : [];
  const userById = new Map(shareUsers.map((u) => [u.id, u]));

  const shares = shareRows.map((s) => ({ ...s, user: userById.get(s.userId) }));

  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.taskListId, listId))
    .orderBy(asc(tasks.order))
    .all();

  const subtasksByParent = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (t.parentId !== null) {
      const arr = subtasksByParent.get(t.parentId) ?? [];
      arr.push(t);
      subtasksByParent.set(t.parentId, arr);
    }
  }

  const topLevelTasks = allTasks
    .filter((t) => t.parentId === null)
    .map((t) => ({ ...t, subtasks: subtasksByParent.get(t.id) ?? [] }));

  const list = { ...listRow, tasks: topLevelTasks, shares, owner };

  return { list, isOwner, permission };
}

export async function checkWriteAccess(db: Db, listId: string, userId: string): Promise<void> {
  const listRow = await db
    .select({ id: taskLists.id, ownerId: taskLists.ownerId })
    .from(taskLists)
    .where(eq(taskLists.id, listId))
    .get();

  if (!listRow) httpError(403, 'Forbidden');
  if (listRow.ownerId === userId) return;

  const share = await db
    .select()
    .from(taskListShares)
    .where(
      and(
        eq(taskListShares.taskListId, listId),
        eq(taskListShares.userId, userId),
        eq(taskListShares.permission, 'WRITE'),
      ),
    )
    .get();

  if (!share) httpError(403, 'Forbidden');
}

export async function updateTaskList(db: Db, listId: string, userId: string, name: string) {
  const listRow = await db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');
  if (listRow.ownerId !== userId) httpError(403, 'Forbidden');

  return await db.update(taskLists).set({ name }).where(eq(taskLists.id, listId)).returning().get();
}

export async function deleteTaskList(db: Db, listId: string, userId: string): Promise<void> {
  const listRow = await db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');
  if (listRow.ownerId !== userId) httpError(403, 'Forbidden');

  await db.delete(taskLists).where(eq(taskLists.id, listId)).run();
}
