import { and, eq } from 'drizzle-orm';
import { taskLists, taskListShares, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

/** Port of backend/src/services/shares.ts. */
export function getShares(db: Db, taskListId: string, userId: string) {
  const list = db.select().from(taskLists).where(eq(taskLists.id, taskListId)).get();
  if (!list || list.ownerId !== userId) httpError(404, 'Not found');

  const shareRows = db.select().from(taskListShares).where(eq(taskListShares.taskListId, taskListId)).all();

  return shareRows.map((s) => {
    const user = db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, s.userId)).get();
    return { ...s, user };
  });
}

export function createShare(db: Db, taskListId: string, ownerId: string, email: string, permission: Permission) {
  const list = db.select().from(taskLists).where(eq(taskLists.id, taskListId)).get();
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const invitee = db.select().from(users).where(eq(users.email, email)).get();
  if (!invitee) httpError(404, 'User not found');

  if (invitee.id === ownerId) httpError(400, 'Cannot share with yourself');

  const existing = db
    .select()
    .from(taskListShares)
    .where(and(eq(taskListShares.taskListId, taskListId), eq(taskListShares.userId, invitee.id)))
    .get();
  if (existing) httpError(409, 'Already shared');

  const share = db
    .insert(taskListShares)
    .values({ taskListId, userId: invitee.id, permission })
    .returning()
    .get();

  return { ...share, user: { id: invitee.id, email: invitee.email, name: invitee.name } };
}

export function updateShare(db: Db, taskListId: string, shareId: string, ownerId: string, permission: Permission) {
  const list = db.select().from(taskLists).where(eq(taskLists.id, taskListId)).get();
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const share = db
    .select()
    .from(taskListShares)
    .where(and(eq(taskListShares.id, shareId), eq(taskListShares.taskListId, taskListId)))
    .get();
  if (!share) httpError(404, 'Not found');

  return db.update(taskListShares).set({ permission }).where(eq(taskListShares.id, shareId)).returning().get();
}

export function deleteShare(db: Db, taskListId: string, shareId: string, ownerId: string): void {
  const list = db.select().from(taskLists).where(eq(taskLists.id, taskListId)).get();
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const share = db
    .select()
    .from(taskListShares)
    .where(and(eq(taskListShares.id, shareId), eq(taskListShares.taskListId, taskListId)))
    .get();
  if (!share) httpError(404, 'Not found');

  db.delete(taskListShares).where(eq(taskListShares.id, shareId)).run();
}
