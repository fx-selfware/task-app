import { PrismaClient, Permission } from '@prisma/client';
import { httpError } from '../utils/httpError';

export async function getTemplateShares(prisma: PrismaClient, templateId: string, userId: string) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== userId) httpError(404, 'Not found');

  return prisma.templateShare.findMany({
    where: { templateId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

export async function createTemplateShare(
  prisma: PrismaClient,
  templateId: string,
  ownerId: string,
  email: string,
  permission: Permission,
) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== ownerId) httpError(404, 'Not found');

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) httpError(404, 'User not found');

  if (invitee.id === ownerId) httpError(400, 'Cannot share with yourself');

  const existing = await prisma.templateShare.findUnique({
    where: { templateId_userId: { templateId, userId: invitee.id } },
  });
  if (existing) httpError(409, 'Already shared');

  return prisma.templateShare.create({
    data: { templateId, userId: invitee.id, permission },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}

export async function updateTemplateShare(
  prisma: PrismaClient,
  templateId: string,
  shareId: string,
  ownerId: string,
  permission: Permission,
) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== ownerId) httpError(404, 'Not found');

  const share = await prisma.templateShare.findFirst({ where: { id: shareId, templateId } });
  if (!share) httpError(404, 'Not found');

  return prisma.templateShare.update({ where: { id: shareId }, data: { permission } });
}

export async function deleteTemplateShare(
  prisma: PrismaClient,
  templateId: string,
  shareId: string,
  ownerId: string,
) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== ownerId) httpError(404, 'Not found');

  const share = await prisma.templateShare.findFirst({ where: { id: shareId, templateId } });
  if (!share) httpError(404, 'Not found');

  await prisma.templateShare.delete({ where: { id: shareId } });
}
