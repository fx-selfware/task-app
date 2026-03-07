import { PrismaClient, TaskStatus } from '@prisma/client';
import { httpError } from '../utils/httpError';

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

export async function createTask(
  prisma: PrismaClient,
  taskListId: string,
  input: CreateTaskInput,
) {
  const effectiveParentId = input.parentId ?? null;

  if (effectiveParentId) {
    const parent = await prisma.task.findFirst({
      where: { id: effectiveParentId, taskListId, parentId: null },
    });
    if (!parent) httpError(400, 'Invalid parent task');
    if (parent.status === 'DONE') httpError(400, 'Cannot add subtask to a completed task');
  }

  const maxOrder = await prisma.task.aggregate({
    where: { taskListId, parentId: effectiveParentId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      order,
      taskListId,
      parentId: effectiveParentId,
    },
  });
}

export async function updateTask(
  prisma: PrismaClient,
  taskListId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const task = await prisma.task.findFirst({ where: { id: taskId, taskListId } });
  if (!task) httpError(404, 'Not found');

  const data = {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status !== undefined && { status: input.status }),
  };

  // Completing a parent task cascades to all subtasks
  if (input.status === 'DONE' && task.parentId === null) {
    return prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { parentId: taskId, status: 'TODO' },
        data: { status: 'DONE' },
      });
      return tx.task.update({ where: { id: taskId }, data });
    });
  }

  // Un-completing a subtask also un-completes its parent
  if (input.status === 'TODO' && task.parentId !== null) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: taskId }, data });
      await tx.task.update({
        where: { id: task.parentId! },
        data: { status: 'TODO' },
      });
      return updated;
    });
  }

  return prisma.task.update({ where: { id: taskId }, data });
}

export async function deleteTask(prisma: PrismaClient, taskListId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, taskListId } });
  if (!task) httpError(404, 'Not found');

  await prisma.task.delete({ where: { id: taskId } });
}

export async function deleteCompletedTasks(prisma: PrismaClient, taskListId: string) {
  await prisma.$transaction(async (tx) => {
    // Delete completed subtasks first
    await tx.task.deleteMany({
      where: { taskListId, status: 'DONE', parentId: { not: null } },
    });
    // Promote remaining TODO subtasks of DONE parents to top-level
    const doneParentIds = (
      await tx.task.findMany({
        where: { taskListId, status: 'DONE', parentId: null },
        select: { id: true },
      })
    ).map((t) => t.id);

    if (doneParentIds.length > 0) {
      await tx.task.updateMany({
        where: { parentId: { in: doneParentIds } },
        data: { parentId: null },
      });
    }
    // Delete completed top-level tasks
    await tx.task.deleteMany({
      where: { taskListId, status: 'DONE', parentId: null },
    });
  });
}

export async function deleteCompletedSubtasks(
  prisma: PrismaClient,
  taskListId: string,
  parentId: string,
) {
  const parent = await prisma.task.findFirst({
    where: { id: parentId, taskListId, parentId: null },
  });
  if (!parent) httpError(404, 'Not found');

  await prisma.task.deleteMany({
    where: { taskListId, parentId, status: 'DONE' },
  });
}

export async function reorderTasks(
  prisma: PrismaClient,
  taskListId: string,
  orderedIds: string[],
  parentId: string | null = null,
) {
  const tasks = await prisma.task.findMany({
    where: { taskListId, parentId },
    select: { id: true },
  });
  const existingIds = new Set(tasks.map((t) => t.id));

  for (const id of orderedIds) {
    if (!existingIds.has(id)) httpError(400, 'Task not found in list');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.task.update({ where: { id }, data: { order: index } }),
    ),
  );
}
