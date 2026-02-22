import { PrismaClient, TaskStatus } from '@prisma/client';

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string | null;
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
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
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
  if (!task) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
    },
  });
}

export async function deleteTask(prisma: PrismaClient, taskListId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, taskListId } });
  if (!task) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await prisma.task.delete({ where: { id: taskId } });
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
    if (!existingIds.has(id)) {
      const err = new Error('Task not found in list') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.task.update({ where: { id }, data: { order: index } }),
    ),
  );
}
