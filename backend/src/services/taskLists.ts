import { PrismaClient } from '@prisma/client';

export async function getTaskLists(prisma: PrismaClient, userId: string) {
  const owned = await prisma.taskList.findMany({
    where: { ownerId: userId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const shared = await prisma.taskList.findMany({
    where: {
      shares: { some: { userId } },
    },
    include: {
      _count: { select: { tasks: true } },
      shares: { where: { userId }, select: { permission: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    owned: owned.map((l) => ({ ...l, role: 'owner' as const })),
    shared: shared.map((l) => ({
      ...l,
      role: 'shared' as const,
      permission: l.shares[0]?.permission ?? 'READ',
    })),
  };
}

export async function createTaskList(prisma: PrismaClient, userId: string, name: string) {
  return prisma.taskList.create({
    data: { name, ownerId: userId },
  });
}

export async function getTaskListWithAccess(
  prisma: PrismaClient,
  listId: string,
  userId: string,
) {
  const list = await prisma.taskList.findFirst({
    where: {
      id: listId,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    include: {
      tasks: { orderBy: { order: 'asc' } },
      shares: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
      owner: { select: { id: true, email: true, name: true } },
    },
  });

  if (!list) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const isOwner = list.ownerId === userId;
  const share = list.shares.find((s) => s.userId === userId);
  const permission = isOwner ? 'WRITE' : (share?.permission ?? 'READ');

  return { list, isOwner, permission };
}

export async function updateTaskList(
  prisma: PrismaClient,
  listId: string,
  userId: string,
  name: string,
) {
  const list = await prisma.taskList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return prisma.taskList.update({ where: { id: listId }, data: { name } });
}

export async function deleteTaskList(prisma: PrismaClient, listId: string, userId: string) {
  const list = await prisma.taskList.findUnique({ where: { id: listId } });
  if (!list || list.ownerId !== userId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await prisma.taskList.delete({ where: { id: listId } });
}
