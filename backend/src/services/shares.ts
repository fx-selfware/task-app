import { PrismaClient, Permission } from '@prisma/client';

export async function getShares(prisma: PrismaClient, taskListId: string, userId: string) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== userId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return prisma.taskListShare.findMany({
    where: { taskListId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

export async function createShare(
  prisma: PrismaClient,
  taskListId: string,
  ownerId: string,
  email: string,
  permission: Permission,
) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== ownerId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (invitee.id === ownerId) {
    const err = new Error('Cannot share with yourself') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.taskListShare.findUnique({
    where: { taskListId_userId: { taskListId, userId: invitee.id } },
  });
  if (existing) {
    const err = new Error('Already shared') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  return prisma.taskListShare.create({
    data: { taskListId, userId: invitee.id, permission },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

export async function updateShare(
  prisma: PrismaClient,
  taskListId: string,
  shareId: string,
  ownerId: string,
  permission: Permission,
) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== ownerId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const share = await prisma.taskListShare.findFirst({ where: { id: shareId, taskListId } });
  if (!share) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return prisma.taskListShare.update({ where: { id: shareId }, data: { permission } });
}

export async function deleteShare(
  prisma: PrismaClient,
  taskListId: string,
  shareId: string,
  ownerId: string,
) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== ownerId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const share = await prisma.taskListShare.findFirst({ where: { id: shareId, taskListId } });
  if (!share) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await prisma.taskListShare.delete({ where: { id: shareId } });
}
