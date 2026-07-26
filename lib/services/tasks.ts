import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { tasks, type TaskStatus } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';
import { assertWriteAccess, listRowStatement, myShareStatement } from '@/lib/services/taskLists';

/**
 * Each function authorizes itself, batching the two access-check statements
 * with the reads it needs anyway. Writes go through `db.batch` rather than
 * `db.transaction`: batch is equally atomic but costs one round trip, while an
 * interactive transaction pays for BEGIN, every statement, and COMMIT.
 */

export interface CreateTaskInput {
  /** Client-generated so the optimistic row is the real row; see lib/ids.ts. */
  id?: string;
  title: string;
  description?: string;
  parentId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

function siblingCondition(taskListId: string, parentId: string | null) {
  return parentId === null
    ? and(eq(tasks.taskListId, taskListId), isNull(tasks.parentId))
    : and(eq(tasks.taskListId, taskListId), eq(tasks.parentId, parentId));
}

export async function createTask(db: Db, taskListId: string, userId: string, input: CreateTaskInput) {
  const effectiveParentId = input.parentId ?? null;

  // The parent lookup is issued unconditionally so it can share this batch; it
  // matches nothing (and is ignored below) when there is no parent.
  const [listRows, shareRows, parentRows, maxRows] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, effectiveParentId ?? ''), eq(tasks.taskListId, taskListId), isNull(tasks.parentId))),
    db
      .select({ maxOrder: sql<number | null>`max(${tasks.order})` })
      .from(tasks)
      .where(siblingCondition(taskListId, effectiveParentId)),
  ]);

  assertWriteAccess(listRows, shareRows, userId);

  if (effectiveParentId) {
    const parent = parentRows[0];
    if (!parent) httpError(400, 'Invalid parent task');
    if (parent.status === 'DONE') httpError(400, 'Cannot add subtask to a completed task');
  }

  const order = (maxRows[0]?.maxOrder ?? -1) + 1;

  return await db
    .insert(tasks)
    .values({
      ...(input.id ? { id: input.id } : {}),
      title: input.title,
      description: input.description,
      order,
      taskListId,
      parentId: effectiveParentId,
    })
    .returning()
    .get();
}

export async function updateTask(
  db: Db,
  taskListId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const [listRows, shareRows, taskRows] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
    db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))),
  ]);

  assertWriteAccess(listRows, shareRows, userId);

  const task = taskRows[0];
  if (!task) httpError(404, 'Not found');

  const data: Partial<typeof tasks.$inferInsert> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;

  // Completing a parent task cascades to all subtasks
  if (input.status === 'DONE' && task.parentId === null) {
    const [, updated] = await db.batch([
      db
        .update(tasks)
        .set({ status: 'DONE' })
        .where(and(eq(tasks.parentId, taskId), eq(tasks.status, 'TODO'))),
      db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning(),
    ]);
    return updated[0];
  }

  // Un-completing a subtask also un-completes its parent
  if (input.status === 'TODO' && task.parentId !== null) {
    const [updated] = await db.batch([
      db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning(),
      db.update(tasks).set({ status: 'TODO' }).where(eq(tasks.id, task.parentId)),
    ]);
    return updated[0];
  }

  return await db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning().get();
}

export async function deleteTask(db: Db, taskListId: string, userId: string, taskId: string): Promise<void> {
  const [listRows, shareRows, taskRows] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
    db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))),
  ]);

  assertWriteAccess(listRows, shareRows, userId);
  if (!taskRows[0]) httpError(404, 'Not found');

  await db.delete(tasks).where(eq(tasks.id, taskId)).run();
}

export async function deleteCompletedTasks(db: Db, taskListId: string, userId: string): Promise<void> {
  const [listRows, shareRows] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
  ]);
  assertWriteAccess(listRows, shareRows, userId);

  // Finding the done parents used to need a round trip of its own; as a
  // subquery it rides along in the same batch. Statement order still matters —
  // each one sees the previous one's effects.
  const doneTopLevelIds = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), isNull(tasks.parentId)));

  await db.batch([
    // Completed subtasks first, so what remains under a done parent is exactly
    // the TODO ones.
    db
      .delete(tasks)
      .where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), sql`${tasks.parentId} is not null`)),
    // Promote those survivors to top-level before their parent disappears.
    db.update(tasks).set({ parentId: null }).where(inArray(tasks.parentId, doneTopLevelIds)),
    db.delete(tasks).where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), isNull(tasks.parentId))),
  ]);
}

export async function deleteCompletedSubtasks(
  db: Db,
  taskListId: string,
  userId: string,
  parentId: string,
): Promise<void> {
  const [listRows, shareRows, parentRows] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, parentId), eq(tasks.taskListId, taskListId), isNull(tasks.parentId))),
  ]);

  assertWriteAccess(listRows, shareRows, userId);
  if (!parentRows[0]) httpError(404, 'Not found');

  await db
    .delete(tasks)
    .where(and(eq(tasks.taskListId, taskListId), eq(tasks.parentId, parentId), eq(tasks.status, 'DONE')))
    .run();
}

export async function moveTask(
  db: Db,
  taskListId: string,
  userId: string,
  taskId: string,
  newParentId: string | null,
) {
  // The current parent is fetched by subquery alongside the task rather than
  // after it, so both branches below have everything they need after this one
  // round trip.
  const [listRows, shareRows, taskRows, formerParentRows, subtaskCountRows, newParentRows, maxSubRows] =
    await db.batch([
      listRowStatement(db, taskListId),
      myShareStatement(db, taskListId, userId),
      db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))),
      db.select().from(tasks).where(sql`${tasks.id} = (select parent_id from tasks where id = ${taskId})`),
      db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.parentId, taskId)),
      db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, newParentId ?? ''), eq(tasks.taskListId, taskListId), isNull(tasks.parentId))),
      db
        .select({ maxOrder: sql<number | null>`max(${tasks.order})` })
        .from(tasks)
        .where(eq(tasks.parentId, newParentId ?? '')),
    ]);

  assertWriteAccess(listRows, shareRows, userId);

  const task = taskRows[0];
  if (!task) httpError(404, 'Not found');
  if (task.status !== 'TODO') httpError(400, 'Cannot move a completed task');
  if (task.parentId === newParentId) return task;

  if (newParentId !== null) {
    // --- DEMOTE / REPARENT: move under a new parent ---
    if ((subtaskCountRows[0]?.count ?? 0) > 0) httpError(400, 'Cannot move a task that has subtasks');
    if (newParentId === taskId) httpError(400, 'Cannot move task under itself');

    const newParent = newParentRows[0];
    if (!newParent) httpError(400, 'Invalid parent task');
    if (newParent.status !== 'TODO') httpError(400, 'Cannot move under a completed task');

    const [, moved] = await db.batch([
      // Close the gap in the old sibling group
      db
        .update(tasks)
        .set({ order: sql`${tasks.order} - 1` })
        .where(and(siblingCondition(taskListId, task.parentId), gt(tasks.order, task.order))),
      db
        .update(tasks)
        .set({ parentId: newParentId, order: (maxSubRows[0]?.maxOrder ?? -1) + 1 })
        .where(eq(tasks.id, taskId))
        .returning(),
    ]);
    return moved[0];
  }

  // --- PROMOTE: subtask → top-level ---
  if (task.parentId === null) httpError(400, 'Task is already top-level');

  const parent = formerParentRows[0];
  if (!parent) httpError(404, 'Parent not found');

  const [, promoted] = await db.batch([
    db
      .update(tasks)
      .set({ order: sql`${tasks.order} + 1` })
      .where(and(eq(tasks.taskListId, taskListId), isNull(tasks.parentId), gt(tasks.order, parent.order))),
    db
      .update(tasks)
      .set({ parentId: null, order: parent.order + 1 })
      .where(eq(tasks.id, taskId))
      .returning(),
  ]);
  return promoted[0];
}

export async function reorderTasks(
  db: Db,
  taskListId: string,
  userId: string,
  orderedIds: string[],
  parentId: string | null = null,
): Promise<void> {
  const [listRows, shareRows, existing] = await db.batch([
    listRowStatement(db, taskListId),
    myShareStatement(db, taskListId, userId),
    db.select({ id: tasks.id }).from(tasks).where(siblingCondition(taskListId, parentId)),
  ]);

  assertWriteAccess(listRows, shareRows, userId);

  const existingIds = new Set(existing.map((t) => t.id));
  for (const id of orderedIds) {
    if (!existingIds.has(id)) httpError(400, 'Task not found in list');
  }

  if (orderedIds.length === 0) return;

  const statements = orderedIds.map((id, index) => db.update(tasks).set({ order: index }).where(eq(tasks.id, id)));
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}
