import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/httpError';

export async function getTaskLists(prisma: PrismaClient, userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.taskList.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskList.findMany({
      where: {
        shares: { some: { userId } },
      },
      include: {
        _count: { select: { tasks: true } },
        shares: { where: { userId }, select: { permission: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

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
      tasks: {
        where: { parentId: null },
        orderBy: { order: 'asc' },
        include: { subtasks: { orderBy: { order: 'asc' } } },
      },
      shares: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
      owner: { select: { id: true, email: true, name: true } },
    },
  });

  if (!list) httpError(404, 'Not found');

  const isOwner = list.ownerId === userId;
  const share = list.shares.find((s) => s.userId === userId);
  const permission = isOwner ? 'WRITE' : (share?.permission ?? 'READ');

  return { list, isOwner, permission };
}

export async function checkWriteAccess(
  prisma: PrismaClient,
  listId: string,
  userId: string,
): Promise<void> {
  const list = await prisma.taskList.findFirst({
    where: {
      id: listId,
      OR: [
        { ownerId: userId },
        { shares: { some: { userId, permission: 'WRITE' } } },
      ],
    },
    select: { id: true },
  });
  if (!list) httpError(403, 'Forbidden');
}

export async function updateTaskList(
  prisma: PrismaClient,
  listId: string,
  userId: string,
  name: string,
) {
  const list = await prisma.taskList.findUnique({ where: { id: listId } });
  if (!list) httpError(404, 'Not found');
  if (list.ownerId !== userId) httpError(403, 'Forbidden');

  return prisma.taskList.update({ where: { id: listId }, data: { name } });
}

export async function deleteTaskList(prisma: PrismaClient, listId: string, userId: string) {
  const list = await prisma.taskList.findUnique({ where: { id: listId } });
  if (!list) httpError(404, 'Not found');
  if (list.ownerId !== userId) httpError(403, 'Forbidden');

  await prisma.taskList.delete({ where: { id: listId } });
}
