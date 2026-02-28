import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/httpError';

export interface CreateTemplateInput {
  name: string;
}

export interface CreateTemplateTaskInput {
  title: string;
  description?: string;
}

export interface UpdateTemplateTaskInput {
  title?: string;
  description?: string;
}

export async function getTemplates(prisma: PrismaClient, userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.taskTemplate.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskTemplate.findMany({
      where: { shares: { some: { userId } } },
      include: {
        _count: { select: { tasks: true } },
        shares: { where: { userId }, select: { permission: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    owned: owned.map((t) => ({ ...t, role: 'owner' as const })),
    shared: shared.map((t) => ({
      ...t,
      role: 'shared' as const,
      permission: t.shares[0]?.permission,
      shares: undefined,
    })),
  };
}

export async function createTemplate(
  prisma: PrismaClient,
  userId: string,
  input: CreateTemplateInput,
) {
  return prisma.taskTemplate.create({ data: { name: input.name, ownerId: userId } });
}

export async function getTemplateWithAccess(
  prisma: PrismaClient,
  templateId: string,
  userId: string,
) {
  const template = await prisma.taskTemplate.findFirst({
    where: {
      id: templateId,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    include: {
      tasks: { orderBy: { order: 'asc' } },
      shares: { where: { userId }, select: { permission: true } },
    },
  });

  if (!template) httpError(404, 'Not found');

  const isOwner = template.ownerId === userId;
  const permission = isOwner ? ('WRITE' as const) : (template.shares[0]?.permission ?? null);

  return { template: { ...template, shares: undefined }, isOwner, permission };
}

async function requireWriteAccess(prisma: PrismaClient, templateId: string, userId: string) {
  const template = await prisma.taskTemplate.findFirst({
    where: {
      id: templateId,
      OR: [
        { ownerId: userId },
        { shares: { some: { userId, permission: 'WRITE' } } },
      ],
    },
  });
  if (!template) httpError(404, 'Not found');
  return template;
}

export async function updateTemplate(
  prisma: PrismaClient,
  templateId: string,
  userId: string,
  name: string,
) {
  await requireWriteAccess(prisma, templateId, userId);
  return prisma.taskTemplate.update({ where: { id: templateId }, data: { name } });
}

export async function deleteTemplate(
  prisma: PrismaClient,
  templateId: string,
  userId: string,
) {
  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, ownerId: userId },
  });
  if (!template) httpError(404, 'Not found');

  await prisma.taskTemplate.delete({ where: { id: templateId } });
}

export async function createTemplateTask(
  prisma: PrismaClient,
  templateId: string,
  userId: string,
  input: CreateTemplateTaskInput,
) {
  await requireWriteAccess(prisma, templateId, userId);

  const maxOrder = await prisma.templateTask.aggregate({
    where: { templateId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  return prisma.templateTask.create({
    data: { title: input.title, description: input.description, order, templateId },
  });
}

export async function updateTemplateTask(
  prisma: PrismaClient,
  templateId: string,
  taskId: string,
  userId: string,
  input: UpdateTemplateTaskInput,
) {
  await requireWriteAccess(prisma, templateId, userId);

  const task = await prisma.templateTask.findFirst({ where: { id: taskId, templateId } });
  if (!task) httpError(404, 'Not found');

  return prisma.templateTask.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });
}

export async function deleteTemplateTask(
  prisma: PrismaClient,
  templateId: string,
  taskId: string,
  userId: string,
) {
  await requireWriteAccess(prisma, templateId, userId);

  const task = await prisma.templateTask.findFirst({ where: { id: taskId, templateId } });
  if (!task) httpError(404, 'Not found');

  await prisma.templateTask.delete({ where: { id: taskId } });
}

export async function reorderTemplateTasks(
  prisma: PrismaClient,
  templateId: string,
  userId: string,
  orderedIds: string[],
) {
  await requireWriteAccess(prisma, templateId, userId);

  const tasks = await prisma.templateTask.findMany({
    where: { templateId },
    select: { id: true },
  });
  const existingIds = new Set(tasks.map((t) => t.id));

  for (const id of orderedIds) {
    if (!existingIds.has(id)) httpError(400, 'Task not found in template');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.templateTask.update({ where: { id }, data: { order: index } }),
    ),
  );
}

export async function applyTemplate(
  prisma: PrismaClient,
  templateId: string,
  taskListId: string,
  requestingUserId: string,
) {
  const template = await prisma.taskTemplate.findFirst({
    where: {
      id: templateId,
      OR: [
        { ownerId: requestingUserId },
        { shares: { some: { userId: requestingUserId } } },
      ],
    },
    include: { tasks: { orderBy: { order: 'asc' } } },
  });
  if (!template) httpError(404, 'Template not found');

  // Check write access on target list
  const list = await prisma.taskList.findFirst({
    where: {
      id: taskListId,
      OR: [
        { ownerId: requestingUserId },
        {
          shares: {
            some: { userId: requestingUserId, permission: 'WRITE' },
          },
        },
      ],
    },
  });
  if (!list) httpError(403, 'No write access to task list');

  const maxOrder = await prisma.task.aggregate({
    where: { taskListId },
    _max: { order: true },
  });
  const baseOrder = (maxOrder._max.order ?? -1) + 1;

  const created = await prisma.$transaction(
    template.tasks.map((tt, i) =>
      prisma.task.create({
        data: {
          title: tt.title,
          description: tt.description,
          order: baseOrder + i,
          taskListId,
        },
      }),
    ),
  );

  return created;
}
