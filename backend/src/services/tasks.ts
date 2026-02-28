import { PrismaClient, TaskStatus } from '@prisma/client';
import { httpError } from '../utils/httpError';

export interface CreateTaskInput {
  title: string;
  description?: string;
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
  const maxOrder = await prisma.task.aggregate({
    where: { taskListId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      order,
      taskListId,
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

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });
}

export async function deleteTask(prisma: PrismaClient, taskListId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, taskListId } });
  if (!task) httpError(404, 'Not found');

  await prisma.task.delete({ where: { id: taskId } });
}

export async function deleteCompletedTasks(prisma: PrismaClient, taskListId: string) {
  await prisma.task.deleteMany({ where: { taskListId, status: 'DONE' } });
}

export async function reorderTasks(
  prisma: PrismaClient,
  taskListId: string,
  orderedIds: string[],
) {
  // Verify all IDs belong to this list
  const tasks = await prisma.task.findMany({ where: { taskListId }, select: { id: true } });
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
