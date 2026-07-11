import { and, eq, inArray } from 'drizzle-orm';
import { taskTemplates, templateShares, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

async function requireOwner(db: Db, templateId: string, ownerId: string) {
  const template = await db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)).get();
  if (!template || template.ownerId !== ownerId) httpError(404, 'Not found');
  return template;
}

export async function getTemplateShares(db: Db, templateId: string, userId: string) {
  await requireOwner(db, templateId, userId);

  const shareRows = await db.select().from(templateShares).where(eq(templateShares.templateId, templateId)).all();

  const userIds = shareRows.map((s) => s.userId);
  const userRows =
    userIds.length > 0
      ? await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
          .all()
      : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  return shareRows.map((s) => ({ ...s, user: userById.get(s.userId) }));
}

export async function createTemplateShare(
  db: Db,
  templateId: string,
  ownerId: string,
  email: string,
  permission: Permission,
) {
  await requireOwner(db, templateId, ownerId);

  const invitee = await db.select().from(users).where(eq(users.email, email)).get();
  if (!invitee) httpError(404, 'User not found');

  if (invitee.id === ownerId) httpError(400, 'Cannot share with yourself');

  const existing = await db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.templateId, templateId), eq(templateShares.userId, invitee.id)))
    .get();
  if (existing) httpError(409, 'Already shared');

  const share = await db
    .insert(templateShares)
    .values({ templateId, userId: invitee.id, permission })
    .returning()
    .get();

  return { ...share, user: { id: invitee.id, email: invitee.email, name: invitee.name } };
}

export async function updateTemplateShare(
  db: Db,
  templateId: string,
  shareId: string,
  ownerId: string,
  permission: Permission,
) {
  await requireOwner(db, templateId, ownerId);

  const share = await db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.id, shareId), eq(templateShares.templateId, templateId)))
    .get();
  if (!share) httpError(404, 'Not found');

  return await db.update(templateShares).set({ permission }).where(eq(templateShares.id, shareId)).returning().get();
}

export async function deleteTemplateShare(db: Db, templateId: string, shareId: string, ownerId: string): Promise<void> {
  await requireOwner(db, templateId, ownerId);

  const share = await db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.id, shareId), eq(templateShares.templateId, templateId)))
    .get();
  if (!share) httpError(404, 'Not found');

  await db.delete(templateShares).where(eq(templateShares.id, shareId)).run();
}
