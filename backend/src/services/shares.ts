import { PrismaClient, Permission } from '@prisma/client';
import { httpError } from '../utils/httpError';

export async function getShares(prisma: PrismaClient, taskListId: string, userId: string) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== userId) httpError(404, 'Not found');

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
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) httpError(404, 'User not found');

  if (invitee.id === ownerId) httpError(400, 'Cannot share with yourself');

  const existing = await prisma.taskListShare.findUnique({
    where: { taskListId_userId: { taskListId, userId: invitee.id } },
  });
  if (existing) httpError(409, 'Already shared');

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
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const share = await prisma.taskListShare.findFirst({ where: { id: shareId, taskListId } });
  if (!share) httpError(404, 'Not found');

  return prisma.taskListShare.update({ where: { id: shareId }, data: { permission } });
}

export async function deleteShare(
  prisma: PrismaClient,
  taskListId: string,
  shareId: string,
  ownerId: string,
) {
  const list = await prisma.taskList.findUnique({ where: { id: taskListId } });
  if (!list || list.ownerId !== ownerId) httpError(404, 'Not found');

  const share = await prisma.taskListShare.findFirst({ where: { id: shareId, taskListId } });
  if (!share) httpError(404, 'Not found');

  await prisma.taskListShare.delete({ where: { id: shareId } });
}
