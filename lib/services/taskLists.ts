import { and, asc, eq, sql } from 'drizzle-orm';
import { taskLists, taskListShares, tasks, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

function countTasks(db: Db, taskListId: string): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.taskListId, taskListId))
    .get();
  return row?.count ?? 0;
}

export function getTaskLists(db: Db, userId: string) {
  const ownedRows = db
    .select()
    .from(taskLists)
    .where(eq(taskLists.ownerId, userId))
    .orderBy(asc(taskLists.createdAt))
    .all();

  const owned = ownedRows.map((l) => ({
    ...l,
    _count: { tasks: countTasks(db, l.id) },
    role: 'owner' as const,
  }));

  const sharedRows = db
    .select({ list: taskLists, permission: taskListShares.permission })
    .from(taskLists)
    .innerJoin(
      taskListShares,
      and(eq(taskListShares.taskListId, taskLists.id), eq(taskListShares.userId, userId)),
    )
    .orderBy(asc(taskLists.createdAt))
    .all();

  const shared = sharedRows.map(({ list, permission }) => ({
    ...list,
    _count: { tasks: countTasks(db, list.id) },
    shares: [{ permission }],
    role: 'shared' as const,
    permission: permission ?? 'READ',
  }));

  return { owned, shared };
}

export function createTaskList(db: Db, userId: string, name: string) {
  return db.insert(taskLists).values({ name, ownerId: userId }).returning().get();
}

export function getTaskListWithAccess(db: Db, listId: string, userId: string) {
  const listRow = db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');

  const shareRows = db.select().from(taskListShares).where(eq(taskListShares.taskListId, listId)).all();
  const isOwner = listRow.ownerId === userId;
  const myShare = shareRows.find((s) => s.userId === userId);
  if (!isOwner && !myShare) httpError(404, 'Not found');

  const permission: Permission = isOwner ? 'WRITE' : (myShare?.permission ?? 'READ');

  const owner = db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, listRow.ownerId))
    .get();

  const shares = shareRows.map((s) => {
    const user = db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, s.userId))
      .get();
    return { ...s, user };
  });

  const allTasks = db
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

export function checkWriteAccess(db: Db, listId: string, userId: string): void {
  const listRow = db
    .select({ id: taskLists.id, ownerId: taskLists.ownerId })
    .from(taskLists)
    .where(eq(taskLists.id, listId))
    .get();

  if (!listRow) httpError(403, 'Forbidden');
  if (listRow.ownerId === userId) return;

  const share = db
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

export function updateTaskList(db: Db, listId: string, userId: string, name: string) {
  const listRow = db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');
  if (listRow.ownerId !== userId) httpError(403, 'Forbidden');

  return db.update(taskLists).set({ name }).where(eq(taskLists.id, listId)).returning().get();
}

export function deleteTaskList(db: Db, listId: string, userId: string): void {
  const listRow = db.select().from(taskLists).where(eq(taskLists.id, listId)).get();
  if (!listRow) httpError(404, 'Not found');
  if (listRow.ownerId !== userId) httpError(403, 'Forbidden');

  db.delete(taskLists).where(eq(taskLists.id, listId)).run();
}
