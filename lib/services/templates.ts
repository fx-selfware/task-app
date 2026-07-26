import { createId } from '@paralleldrive/cuid2';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  taskLists,
  taskListShares,
  taskTemplates,
  tasks,
  templateShares,
  templateTasks,
  type Permission,
} from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

export interface CreateTemplateInput {
  name: string;
  /** Client-generated so the optimistic row is the real row; see lib/ids.ts. */
  id?: string;
}

export interface CreateTemplateTaskInput {
  /** Client-generated so the optimistic row is the real row; see lib/ids.ts. */
  id?: string;
  title: string;
  description?: string;
  parentId?: string;
}

export interface UpdateTemplateTaskInput {
  title?: string;
  description?: string;
}

function siblingCondition(templateId: string, parentId: string | null) {
  return parentId === null
    ? and(eq(templateTasks.templateId, templateId), isNull(templateTasks.parentId))
    : and(eq(templateTasks.templateId, templateId), eq(templateTasks.parentId, parentId));
}

export async function getTemplates(db: Db, userId: string) {
  // One round trip. This used to issue a count query per template — an N+1
  // that grew with the number of templates the caller could see.
  const [ownedRows, sharedRows, countRows] = await db.batch([
    db.select().from(taskTemplates).where(eq(taskTemplates.ownerId, userId)).orderBy(asc(taskTemplates.createdAt)),
    db
      .select({ template: taskTemplates, permission: templateShares.permission })
      .from(taskTemplates)
      .innerJoin(templateShares, and(eq(templateShares.templateId, taskTemplates.id), eq(templateShares.userId, userId)))
      .orderBy(asc(taskTemplates.createdAt)),
    db
      .select({ templateId: templateTasks.templateId, count: sql<number>`count(*)` })
      .from(templateTasks)
      .where(
        sql`${templateTasks.templateId} in (
          select ${taskTemplates.id} from ${taskTemplates} where ${taskTemplates.ownerId} = ${userId}
          union
          select ${templateShares.templateId} from ${templateShares} where ${templateShares.userId} = ${userId}
        )`,
      )
      .groupBy(templateTasks.templateId),
  ]);

  const counts = new Map(countRows.map((r) => [r.templateId, r.count]));

  const owned = ownedRows.map((t) => ({
    ...t,
    _count: { tasks: counts.get(t.id) ?? 0 },
    role: 'owner' as const,
  }));

  const shared = sharedRows.map(({ template, permission }) => ({
    ...template,
    _count: { tasks: counts.get(template.id) ?? 0 },
    role: 'shared' as const,
    permission: permission ?? 'READ',
  }));

  return { owned, shared };
}

export async function createTemplate(db: Db, userId: string, input: CreateTemplateInput) {
  return await db
    .insert(taskTemplates)
    .values({ ...(input.id ? { id: input.id } : {}), name: input.name, ownerId: userId })
    .returning()
    .get();
}

export async function getTemplateWithAccess(db: Db, templateId: string, userId: string) {
  const [templateRows, shareRows, allTasks] = await db.batch([
    db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)),
    db.select().from(templateShares).where(eq(templateShares.templateId, templateId)),
    db.select().from(templateTasks).where(eq(templateTasks.templateId, templateId)).orderBy(asc(templateTasks.order)),
  ]);

  const templateRow = templateRows[0];
  if (!templateRow) httpError(404, 'Not found');

  const isOwner = templateRow.ownerId === userId;
  const myShare = shareRows.find((s) => s.userId === userId);
  if (!isOwner && !myShare) httpError(404, 'Not found');

  const permission: Permission | null = isOwner ? 'WRITE' : (myShare?.permission ?? null);

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

  const template = { ...templateRow, tasks: topLevelTasks };

  return { template, isOwner, permission };
}

/** Port of requireWriteAccess: 404 (not 403) when the caller lacks WRITE, mirroring the old service. */
async function requireWriteAccess(db: Db, templateId: string, userId: string) {
  const templateRow = await db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)).get();
  if (!templateRow) httpError(404, 'Not found');
  if (templateRow.ownerId === userId) return templateRow;

  const share = await db
    .select()
    .from(templateShares)
    .where(
      and(
        eq(templateShares.templateId, templateId),
        eq(templateShares.userId, userId),
        eq(templateShares.permission, 'WRITE'),
      ),
    )
    .get();
  if (!share) httpError(404, 'Not found');
  return templateRow;
}

export async function updateTemplate(db: Db, templateId: string, userId: string, name: string) {
  await requireWriteAccess(db, templateId, userId);
  return await db.update(taskTemplates).set({ name }).where(eq(taskTemplates.id, templateId)).returning().get();
}

export async function deleteTemplate(db: Db, templateId: string, userId: string): Promise<void> {
  const templateRow = await db
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.ownerId, userId)))
    .get();
  if (!templateRow) httpError(404, 'Not found');

  await db.delete(taskTemplates).where(eq(taskTemplates.id, templateId)).run();
}

export async function createTemplateTask(db: Db, templateId: string, userId: string, input: CreateTemplateTaskInput) {
  await requireWriteAccess(db, templateId, userId);

  const effectiveParentId = input.parentId ?? null;

  if (effectiveParentId) {
    const parent = await db
      .select()
      .from(templateTasks)
      .where(
        and(
          eq(templateTasks.id, effectiveParentId),
          eq(templateTasks.templateId, templateId),
          isNull(templateTasks.parentId),
        ),
      )
      .get();
    if (!parent) httpError(400, 'Invalid parent task');
  }

  const maxRow = await db
    .select({ maxOrder: sql<number | null>`max(${templateTasks.order})` })
    .from(templateTasks)
    .where(siblingCondition(templateId, effectiveParentId))
    .get();
  const order = (maxRow?.maxOrder ?? -1) + 1;

  return await db
    .insert(templateTasks)
    .values({
      ...(input.id ? { id: input.id } : {}),
      title: input.title,
      description: input.description,
      order,
      templateId,
      parentId: effectiveParentId,
    })
    .returning()
    .get();
}

export async function updateTemplateTask(
  db: Db,
  templateId: string,
  taskId: string,
  userId: string,
  input: UpdateTemplateTaskInput,
) {
  await requireWriteAccess(db, templateId, userId);

  const task = await db
    .select()
    .from(templateTasks)
    .where(and(eq(templateTasks.id, taskId), eq(templateTasks.templateId, templateId)))
    .get();
  if (!task) httpError(404, 'Not found');

  const data: Partial<typeof templateTasks.$inferInsert> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;

  return await db.update(templateTasks).set(data).where(eq(templateTasks.id, taskId)).returning().get();
}

export async function deleteTemplateTask(db: Db, templateId: string, taskId: string, userId: string): Promise<void> {
  await requireWriteAccess(db, templateId, userId);

  const task = await db
    .select()
    .from(templateTasks)
    .where(and(eq(templateTasks.id, taskId), eq(templateTasks.templateId, templateId)))
    .get();
  if (!task) httpError(404, 'Not found');

  await db.delete(templateTasks).where(eq(templateTasks.id, taskId)).run();
}

export async function moveTemplateTask(
  db: Db,
  templateId: string,
  taskId: string,
  userId: string,
  newParentId: string | null,
) {
  await requireWriteAccess(db, templateId, userId);

  return await db.transaction(async (tx) => {
    const task = await tx
      .select()
      .from(templateTasks)
      .where(and(eq(templateTasks.id, taskId), eq(templateTasks.templateId, templateId)))
      .get();
    if (!task) httpError(404, 'Not found');
    if (task.parentId === newParentId) return task;

    if (newParentId !== null) {
      // --- DEMOTE / REPARENT: move under a new parent ---
      const subtaskCountRow = await tx
        .select({ count: sql<number>`count(*)` })
        .from(templateTasks)
        .where(eq(templateTasks.parentId, taskId))
        .get();
      if ((subtaskCountRow?.count ?? 0) > 0) httpError(400, 'Cannot move a task that has subtasks');
      if (newParentId === taskId) httpError(400, 'Cannot move task under itself');

      const newParent = await tx
        .select()
        .from(templateTasks)
        .where(
          and(
            eq(templateTasks.id, newParentId),
            eq(templateTasks.templateId, templateId),
            isNull(templateTasks.parentId),
          ),
        )
        .get();
      if (!newParent) httpError(400, 'Invalid parent task');

      // Close the gap in the old sibling group
      await tx
        .update(templateTasks)
        .set({ order: sql`${templateTasks.order} - 1` })
        .where(and(siblingCondition(templateId, task.parentId), gt(templateTasks.order, task.order)))
        .run();

      const maxSubRow = await tx
        .select({ maxOrder: sql<number | null>`max(${templateTasks.order})` })
        .from(templateTasks)
        .where(eq(templateTasks.parentId, newParentId))
        .get();

      return await tx
        .update(templateTasks)
        .set({ parentId: newParentId, order: (maxSubRow?.maxOrder ?? -1) + 1 })
        .where(eq(templateTasks.id, taskId))
        .returning()
        .get();
    } else {
      // --- PROMOTE: subtask → top-level ---
      if (task.parentId === null) httpError(400, 'Task is already top-level');

      const formerParent = await tx
        .select()
        .from(templateTasks)
        .where(and(eq(templateTasks.id, task.parentId), eq(templateTasks.templateId, templateId)))
        .get();
      if (!formerParent) httpError(404, 'Parent not found');

      await tx
        .update(templateTasks)
        .set({ order: sql`${templateTasks.order} + 1` })
        .where(
          and(
            eq(templateTasks.templateId, templateId),
            isNull(templateTasks.parentId),
            gt(templateTasks.order, formerParent.order),
          ),
        )
        .run();

      return await tx
        .update(templateTasks)
        .set({ parentId: null, order: formerParent.order + 1 })
        .where(eq(templateTasks.id, taskId))
        .returning()
        .get();
    }
  });
}

export async function reorderTemplateTasks(
  db: Db,
  templateId: string,
  userId: string,
  orderedIds: string[],
  parentId: string | null = null,
): Promise<void> {
  await requireWriteAccess(db, templateId, userId);

  const existing = await db
    .select({ id: templateTasks.id })
    .from(templateTasks)
    .where(siblingCondition(templateId, parentId))
    .all();
  const existingIds = new Set(existing.map((t) => t.id));

  for (const id of orderedIds) {
    if (!existingIds.has(id)) httpError(400, 'Task not found in template');
  }

  if (orderedIds.length === 0) return;

  const statements = orderedIds.map((id, index) =>
    db.update(templateTasks).set({ order: index }).where(eq(templateTasks.id, id)),
  );
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

export async function applyTemplate(db: Db, templateId: string, taskListId: string, requestingUserId: string) {
  // Round trip 1: both access checks, the template's tasks, and where to start
  // ordering — none of them depend on each other.
  const [templateRows, templateShareRows, templateTaskRows, listRows, listShareRows, maxRows] = await db.batch([
    db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)),
    db
      .select()
      .from(templateShares)
      .where(and(eq(templateShares.templateId, templateId), eq(templateShares.userId, requestingUserId))),
    db.select().from(templateTasks).where(eq(templateTasks.templateId, templateId)).orderBy(asc(templateTasks.order)),
    db.select().from(taskLists).where(eq(taskLists.id, taskListId)),
    db
      .select()
      .from(taskListShares)
      .where(
        and(
          eq(taskListShares.taskListId, taskListId),
          eq(taskListShares.userId, requestingUserId),
          eq(taskListShares.permission, 'WRITE'),
        ),
      ),
    db
      .select({ maxOrder: sql<number | null>`max(${tasks.order})` })
      .from(tasks)
      .where(and(eq(tasks.taskListId, taskListId), isNull(tasks.parentId))),
  ]);

  const templateRow = templateRows[0];
  const hasTemplateAccess =
    !!templateRow && (templateRow.ownerId === requestingUserId || templateShareRows.length > 0);
  if (!hasTemplateAccess) httpError(404, 'Template not found');

  const listRow = listRows[0];
  const hasListWriteAccess = !!listRow && (listRow.ownerId === requestingUserId || listShareRows.length > 0);
  if (!hasListWriteAccess) httpError(403, 'No write access to task list');

  const baseOrder = (maxRows[0]?.maxOrder ?? -1) + 1;

  // Separate parents and subtasks
  const parents = templateTaskRows.filter((tt) => tt.parentId === null);
  const subtasksByParent = new Map<string, typeof templateTaskRows>();
  for (const tt of templateTaskRows.filter((tt) => tt.parentId !== null)) {
    const arr = subtasksByParent.get(tt.parentId!) ?? [];
    arr.push(tt);
    subtasksByParent.set(tt.parentId!, arr);
  }

  if (parents.length === 0) return [];

  // Round trip 2. Generating the ids here instead of reading them back from
  // each insert is what collapses this from one round trip per task to one
  // multi-row insert; parents are listed first so the foreign key on
  // parent_id is satisfied row by row.
  const rows: (typeof tasks.$inferInsert)[] = [];
  const templateIdToTaskId = new Map<string, string>();

  parents.forEach((tt, i) => {
    const id = createId();
    templateIdToTaskId.set(tt.id, id);
    rows.push({
      id,
      title: tt.title,
      description: tt.description,
      order: baseOrder + i,
      taskListId,
      parentId: null,
    });
  });

  for (const [templateParentId, subtasks] of subtasksByParent) {
    const newParentId = templateIdToTaskId.get(templateParentId);
    if (!newParentId) continue;
    subtasks.forEach((st, j) => {
      rows.push({
        id: createId(),
        title: st.title,
        description: st.description,
        order: j,
        taskListId,
        parentId: newParentId,
      });
    });
  }

  return await db.insert(tasks).values(rows).returning().all();
}
