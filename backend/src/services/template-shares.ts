import { PrismaClient, Permission } from '@prisma/client';

export async function getTemplateShares(prisma: PrismaClient, templateId: string, userId: string) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== userId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

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
  if (!template || template.ownerId !== ownerId) {
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

  const existing = await prisma.templateShare.findUnique({
    where: { templateId_userId: { templateId, userId: invitee.id } },
  });
  if (existing) {
    const err = new Error('Already shared') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

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
  if (!template || template.ownerId !== ownerId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const share = await prisma.templateShare.findFirst({ where: { id: shareId, templateId } });
  if (!share) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return prisma.templateShare.update({ where: { id: shareId }, data: { permission } });
}

export async function deleteTemplateShare(
  prisma: PrismaClient,
  templateId: string,
  shareId: string,
  ownerId: string,
) {
  const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.ownerId !== ownerId) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const share = await prisma.templateShare.findFirst({ where: { id: shareId, templateId } });
  if (!share) {
    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  await prisma.templateShare.delete({ where: { id: shareId } });
}
