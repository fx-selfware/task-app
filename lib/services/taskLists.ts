import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { taskLists, taskListShares, tasks, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

/**
 * Access control is expressed as statements rather than a function that runs
 * them, so callers can batch the check with their own work: over a remote
 * database it is free when it rides along and a whole round trip when it
 * doesn't. Pair with `assertWriteAccess`, which applies the same rules the
 * standalone `checkWriteAccess` did.
 */
export function listRowStatement(db: Db, listId: string) {
  return db.select({ id: taskLists.id, ownerId: taskLists.ownerId }).from(taskLists).where(eq(taskLists.id, listId));
}

export function myShareStatement(db: Db, listId: string, userId: string) {
  return db
    .select({ permission: taskListShares.permission })
    .from(taskListShares)
    .where(and(eq(taskListShares.taskListId, listId), eq(taskListShares.userId, userId)));
}

type ListRow = { id: string; ownerId: string };
type ShareRow = { permission: Permission };

/** 403 for a missing list too — mirrors the original checkWriteAccess. */
export function assertWriteAccess(listRows: ListRow[], shareRows: ShareRow[], userId: string): void {
  const list = listRows[0];
  if (!list) httpError(403, 'Forbidden');
  if (list.ownerId === userId) return;
  if (shareRows[0]?.permission !== 'WRITE') httpError(403, 'Forbidden');
}

export async function getTaskLists(db: Db, userId: string) {
  // One round trip. The counts subquery is scoped to the caller's own lists —
  // it used to group over every task row in the database.
  const [ownedRows, sharedRows, countRows] = await db.batch([
    db.select().from(taskLists).where(eq(taskLists.ownerId, userId)).orderBy(asc(taskLists.createdAt)),
    db
      .select({ list: taskLists, permission: taskListShares.permission })
      .from(taskLists)
      .innerJoin(taskListShares, and(eq(taskListShares.taskListId, taskLists.id), eq(taskListShares.userId, userId)))
      .orderBy(asc(taskLists.createdAt)),
    db
      .select({ taskListId: tasks.taskListId, count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        sql`${tasks.taskListId} in (
          select ${taskLists.id} from ${taskLists} where ${taskLists.ownerId} = ${userId}
          union
          select ${taskListShares.taskListId} from ${taskListShares} where ${taskListShares.userId} = ${userId}
        )`,
      )
      .groupBy(tasks.taskListId),
  ]);

  const counts = new Map(countRows.map((r) => [r.taskListId, r.count]));

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

export async function createTaskList(db: Db, userId: string, name: string, id?: string) {
  return await db
    .insert(taskLists)
    .values({ ...(id ? { id } : {}), name, ownerId: userId })
    .returning()
    .get();
}

export async function getTaskListWithAccess(db: Db, listId: string, userId: string) {
  // Round trip 1: everything that needs only the list id.
  const [listRows, shareRows, allTasks] = await db.batch([
    db.select().from(taskLists).where(eq(taskLists.id, listId)),
    db.select().from(taskListShares).where(eq(taskListShares.taskListId, listId)),
    db.select().from(tasks).where(eq(tasks.taskListId, listId)).orderBy(asc(tasks.order)),
  ]);

  const listRow = listRows[0];
  if (!listRow) httpError(404, 'Not found');

  const isOwner = listRow.ownerId === userId;
  const myShare = shareRows.find((s) => s.userId === userId);
  if (!isOwner && !myShare) httpError(404, 'Not found');

  const permission: Permission = isOwner ? 'WRITE' : (myShare?.permission ?? 'READ');

  // Round trip 2: the owner and everyone it is shared with, in one query.
  const memberIds = [listRow.ownerId, ...shareRows.map((s) => s.userId)];
  const members = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, memberIds))
    .all();
  const userById = new Map(members.map((u) => [u.id, u]));

  const owner = userById.get(listRow.ownerId);
  const shares = shareRows.map((s) => ({ ...s, user: userById.get(s.userId) }));

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

/**
 * A cheap stand-in for the whole list, so a poll that finds nothing new costs
 * one round trip and a few bytes instead of two and the entire task set. Any
 * write bumps a task's updated_at or changes the row count, and renaming
 * bumps the list's own; shares are excluded because the share modal
 * invalidates directly when it changes them.
 */
export async function getTaskListVersion(db: Db, listId: string, userId: string): Promise<string> {
  const [listRows, shareRows, taskRows] = await db.batch([
    db
      .select({ id: taskLists.id, ownerId: taskLists.ownerId, updatedAt: taskLists.updatedAt })
      .from(taskLists)
      .where(eq(taskLists.id, listId)),
    myShareStatement(db, listId, userId),
    db
      .select({ count: sql<number>`count(*)`, latest: sql<number | null>`max(${tasks.updatedAt})` })
      .from(tasks)
      .where(eq(tasks.taskListId, listId)),
  ]);

  const listRow = listRows[0];
  if (!listRow) httpError(404, 'Not found');
  if (listRow.ownerId !== userId && !shareRows[0]) httpError(404, 'Not found');

  const { count, latest } = taskRows[0] ?? { count: 0, latest: null };
  return `${listRow.updatedAt.getTime()}-${count}-${latest ?? 0}`;
}

/**
 * Standalone access check, for callers with nothing to batch it with. Prefer
 * `listRowStatement` + `myShareStatement` inside an existing batch.
 */
export async function checkWriteAccess(db: Db, listId: string, userId: string): Promise<void> {
  const [listRows, shareRows] = await db.batch([listRowStatement(db, listId), myShareStatement(db, listId, userId)]);
  assertWriteAccess(listRows, shareRows, userId);
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
