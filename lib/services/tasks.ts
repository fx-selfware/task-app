import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { tasks, type TaskStatus } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

export interface CreateTaskInput {
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

export function createTask(db: Db, taskListId: string, input: CreateTaskInput) {
  const effectiveParentId = input.parentId ?? null;

  if (effectiveParentId) {
    const parent = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, effectiveParentId), eq(tasks.taskListId, taskListId), isNull(tasks.parentId)))
      .get();
    if (!parent) httpError(400, 'Invalid parent task');
    if (parent.status === 'DONE') httpError(400, 'Cannot add subtask to a completed task');
  }

  const maxRow = db
    .select({ maxOrder: sql<number | null>`max(${tasks.order})` })
    .from(tasks)
    .where(siblingCondition(taskListId, effectiveParentId))
    .get();
  const order = (maxRow?.maxOrder ?? -1) + 1;

  return db
    .insert(tasks)
    .values({ title: input.title, description: input.description, order, taskListId, parentId: effectiveParentId })
    .returning()
    .get();
}

export function updateTask(db: Db, taskListId: string, taskId: string, input: UpdateTaskInput) {
  const task = db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))).get();
  if (!task) httpError(404, 'Not found');

  const data: Partial<typeof tasks.$inferInsert> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;

  // Completing a parent task cascades to all subtasks
  if (input.status === 'DONE' && task.parentId === null) {
    return db.transaction((tx) => {
      tx.update(tasks)
        .set({ status: 'DONE' })
        .where(and(eq(tasks.parentId, taskId), eq(tasks.status, 'TODO')))
        .run();
      return tx.update(tasks).set(data).where(eq(tasks.id, taskId)).returning().get();
    });
  }

  // Un-completing a subtask also un-completes its parent
  if (input.status === 'TODO' && task.parentId !== null) {
    return db.transaction((tx) => {
      const updated = tx.update(tasks).set(data).where(eq(tasks.id, taskId)).returning().get();
      tx.update(tasks).set({ status: 'TODO' }).where(eq(tasks.id, task.parentId!)).run();
      return updated;
    });
  }

  return db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning().get();
}

export function deleteTask(db: Db, taskListId: string, taskId: string): void {
  const task = db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))).get();
  if (!task) httpError(404, 'Not found');

  db.delete(tasks).where(eq(tasks.id, taskId)).run();
}

export function deleteCompletedTasks(db: Db, taskListId: string): void {
  db.transaction((tx) => {
    // Delete completed subtasks first
    tx.delete(tasks)
      .where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), sql`${tasks.parentId} is not null`))
      .run();

    // Promote remaining TODO subtasks of DONE parents to top-level
    const doneParents = tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), isNull(tasks.parentId)))
      .all();
    const doneParentIds = doneParents.map((t) => t.id);

    if (doneParentIds.length > 0) {
      tx.update(tasks).set({ parentId: null }).where(inArray(tasks.parentId, doneParentIds)).run();
    }

    // Delete completed top-level tasks
    tx.delete(tasks)
      .where(and(eq(tasks.taskListId, taskListId), eq(tasks.status, 'DONE'), isNull(tasks.parentId)))
      .run();
  });
}

export function deleteCompletedSubtasks(db: Db, taskListId: string, parentId: string): void {
  const parent = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, parentId), eq(tasks.taskListId, taskListId), isNull(tasks.parentId)))
    .get();
  if (!parent) httpError(404, 'Not found');

  db.delete(tasks)
    .where(and(eq(tasks.taskListId, taskListId), eq(tasks.parentId, parentId), eq(tasks.status, 'DONE')))
    .run();
}

export function moveTask(db: Db, taskListId: string, taskId: string, newParentId: string | null) {
  return db.transaction((tx) => {
    const task = tx.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.taskListId, taskListId))).get();
    if (!task) httpError(404, 'Not found');
    if (task.status !== 'TODO') httpError(400, 'Cannot move a completed task');
    if (task.parentId === newParentId) return task;

    if (newParentId !== null) {
      // --- DEMOTE / REPARENT: move under a new parent ---
      const subtaskCountRow = tx
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.parentId, taskId))
        .get();
      if ((subtaskCountRow?.count ?? 0) > 0) httpError(400, 'Cannot move a task that has subtasks');
      if (newParentId === taskId) httpError(400, 'Cannot move task under itself');

      const newParent = tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, newParentId), eq(tasks.taskListId, taskListId), isNull(tasks.parentId)))
        .get();
      if (!newParent) httpError(400, 'Invalid parent task');
      if (newParent.status !== 'TODO') httpError(400, 'Cannot move under a completed task');

      // Close the gap in the old sibling group
      tx.update(tasks)
        .set({ order: sql`${tasks.order} - 1` })
        .where(and(siblingCondition(taskListId, task.parentId), gt(tasks.order, task.order)))
        .run();

      const maxSubRow = tx
        .select({ maxOrder: sql<number | null>`max(${tasks.order})` })
        .from(tasks)
        .where(eq(tasks.parentId, newParentId))
        .get();

      return tx
        .update(tasks)
        .set({ parentId: newParentId, order: (maxSubRow?.maxOrder ?? -1) + 1 })
        .where(eq(tasks.id, taskId))
        .returning()
        .get();
    } else {
      // --- PROMOTE: subtask → top-level ---
      if (task.parentId === null) httpError(400, 'Task is already top-level');

      const formerParent = tx.select().from(tasks).where(and(eq(tasks.id, task.parentId), eq(tasks.taskListId, taskListId))).get();
      if (!formerParent) httpError(404, 'Parent not found');

      tx.update(tasks)
        .set({ order: sql`${tasks.order} + 1` })
        .where(and(eq(tasks.taskListId, taskListId), isNull(tasks.parentId), gt(tasks.order, formerParent.order)))
        .run();

      return tx
        .update(tasks)
        .set({ parentId: null, order: formerParent.order + 1 })
        .where(eq(tasks.id, taskId))
        .returning()
        .get();
    }
  });
}

export function reorderTasks(
  db: Db,
  taskListId: string,
  orderedIds: string[],
  parentId: string | null = null,
): void {
  const existing = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(siblingCondition(taskListId, parentId))
    .all();
  const existingIds = new Set(existing.map((t) => t.id));

  for (const id of orderedIds) {
    if (!existingIds.has(id)) httpError(400, 'Task not found in list');
  }

  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(tasks).set({ order: index }).where(eq(tasks.id, id)).run();
    });
  });
}
